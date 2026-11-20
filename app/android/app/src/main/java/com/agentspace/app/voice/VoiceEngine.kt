package com.agentspace.app.voice

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.DataChannel
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.audio.JavaAudioDeviceModule
import java.nio.ByteBuffer
import kotlin.math.sqrt

/**
 * Native voice mode connection (§7.6, §14.2): microphone → WebRTC → OpenAI Realtime, the same protocol as the
 * browser (app/src/features/voice/hooks/use-voice-session.ts) but outside the WebView, so it keeps running with
 * the screen locked. The offer SDP goes to our API (`POST /voice/sessions`) from JS; the answer comes back here.
 */
object VoiceEngine {
    /** Matches app/src/features/voice/interfaces/voice.interfaces.ts REALTIME_DATA_CHANNEL. */
    private const val DATA_CHANNEL = "oai-events"
    private const val GATHER_TIMEOUT_MS = 1_500L
    private const val LEVEL_INTERVAL_MS = 100L

    /** OpenAI Realtime events used to derive who is speaking (same names as RealtimeAudioEvents in the web app). */
    private object RealtimeEvents {
        const val SPEECH_STARTED = "input_audio_buffer.speech_started"
        const val SPEECH_STOPPED = "input_audio_buffer.speech_stopped"
        const val OUTPUT_STARTED = "output_audio_buffer.started"
        const val OUTPUT_STOPPED = "output_audio_buffer.stopped"
        const val OUTPUT_CLEARED = "output_audio_buffer.cleared"
    }

    object Speakers {
        const val USER = "user"
        const val BOT = "bot"
        const val NONE = "none"
    }

    interface Listener {
        /** RTCPeerConnectionState in lower case: new, connecting, connected, disconnected, failed, closed. */
        fun onConnectionState(state: String)
        fun onMessage(json: String)
        fun onSpeaking(who: String)
        fun onLevel(level: Double)
    }

    @Volatile var listener: Listener? = null

    private val main = Handler(Looper.getMainLooper())
    private var initialized = false
    private var factory: PeerConnectionFactory? = null
    private var adm: JavaAudioDeviceModule? = null
    private var pc: PeerConnection? = null
    private var dc: DataChannel? = null
    private var source: AudioSource? = null
    private var track: AudioTrack? = null
    @Volatile private var lastLevelAt = 0L

    val active get() = pc != null

    @Synchronized
    fun createOffer(context: Context, micEnabled: Boolean, done: (sdp: String?, error: String?) -> Unit) {
        stopLocked()
        val app = context.applicationContext
        if (!initialized) {
            PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(app).createInitializationOptions())
            initialized = true
        }
        val module = JavaAudioDeviceModule.builder(app)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .setSamplesReadyCallback { samples -> reportLevel(samples.data) }
            .createAudioDeviceModule()
        adm = module
        val f = PeerConnectionFactory.builder().setAudioDeviceModule(module).createPeerConnectionFactory()
        factory = f

        val config = PeerConnection.RTCConfiguration(emptyList()).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
        }
        val peer = f.createPeerConnection(config, observer) ?: return done(null, "Could not start the voice connection")
        pc = peer
        val src = f.createAudioSource(MediaConstraints())
        source = src
        val mic = f.createAudioTrack("mic", src)
        mic.setEnabled(micEnabled)
        track = mic
        peer.addTrack(mic, listOf("voice"))
        val channel = peer.createDataChannel(DATA_CHANNEL, DataChannel.Init())
        channel.registerObserver(object : DataChannel.Observer {
            override fun onBufferedAmountChange(previousAmount: Long) {}
            override fun onStateChange() {}
            override fun onMessage(buffer: DataChannel.Buffer) {
                if (buffer.binary) return
                val bytes = ByteArray(buffer.data.remaining())
                buffer.data.get(bytes)
                handleMessage(String(bytes, Charsets.UTF_8))
            }
        })
        dc = channel

        peer.createOffer(object : SdpObserverAdapter() {
            override fun onCreateSuccess(desc: SessionDescription) {
                peer.setLocalDescription(object : SdpObserverAdapter() {
                    override fun onSetSuccess() {
                        // Give ICE gathering a moment so the offer carries candidates; the server side is ICE-lite.
                        main.postDelayed({ done(peer.localDescription?.description ?: desc.description, null) }, GATHER_TIMEOUT_MS)
                    }
                    override fun onSetFailure(error: String?) = done(null, error ?: "Could not set the local description")
                }, desc)
            }
            override fun onCreateFailure(error: String?) = done(null, error ?: "Could not create the voice offer")
        }, MediaConstraints())
    }

    @Synchronized
    fun setAnswer(sdp: String, done: (error: String?) -> Unit) {
        val peer = pc ?: return done("Voice mode isn't running")
        peer.setRemoteDescription(object : SdpObserverAdapter() {
            override fun onSetSuccess() = done(null)
            override fun onSetFailure(error: String?) = done(error ?: "Could not use the voice answer")
        }, SessionDescription(SessionDescription.Type.ANSWER, sdp))
    }

    /** Sends a JSON event on the data channel (push-to-talk commits, response.cancel, conversation items…). */
    @Synchronized
    fun send(json: String): Boolean {
        val channel = dc ?: return false
        if (channel.state() != DataChannel.State.OPEN) return false
        return channel.send(DataChannel.Buffer(ByteBuffer.wrap(json.toByteArray(Charsets.UTF_8)), false))
    }

    @Synchronized
    fun setMicEnabled(enabled: Boolean) {
        track?.setEnabled(enabled)
    }

    @Synchronized
    fun stop() = stopLocked()

    private fun stopLocked() {
        dc?.let { it.unregisterObserver(); it.close(); it.dispose() }
        dc = null
        pc?.dispose() // closes the connection and its senders
        pc = null
        track?.let { if (!it.isDisposed) it.dispose() }
        track = null
        source?.dispose()
        source = null
        factory?.dispose()
        factory = null
        adm?.release()
        adm = null
    }

    private fun handleMessage(json: String) {
        listener?.onMessage(json)
        val type = try {
            JSONObject(json).optString("type")
        } catch (e: Exception) {
            return
        }
        when (type) {
            RealtimeEvents.SPEECH_STARTED -> listener?.onSpeaking(Speakers.USER)
            RealtimeEvents.SPEECH_STOPPED -> listener?.onSpeaking(Speakers.NONE)
            RealtimeEvents.OUTPUT_STARTED -> listener?.onSpeaking(Speakers.BOT)
            RealtimeEvents.OUTPUT_STOPPED, RealtimeEvents.OUTPUT_CLEARED -> listener?.onSpeaking(Speakers.NONE)
        }
    }

    /** Microphone level 0..1 (RMS of 16-bit PCM), at most every 100 ms, for the voice bar's waveform. */
    private fun reportLevel(pcm: ByteArray) {
        val now = System.currentTimeMillis()
        if (now - lastLevelAt < LEVEL_INTERVAL_MS || pcm.size < 2) return
        lastLevelAt = now
        var sum = 0.0
        var i = 0
        while (i + 1 < pcm.size) {
            val s = ((pcm[i + 1].toInt() shl 8) or (pcm[i].toInt() and 0xFF)).toShort().toDouble() / Short.MAX_VALUE
            sum += s * s
            i += 2
        }
        listener?.onLevel(sqrt(sum / (pcm.size / 2)).coerceIn(0.0, 1.0))
    }

    private val observer = object : PeerConnection.Observer {
        override fun onSignalingChange(state: PeerConnection.SignalingState) {}
        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState) {}
        override fun onConnectionChange(state: PeerConnection.PeerConnectionState) {
            listener?.onConnectionState(state.name.lowercase())
        }
        override fun onIceConnectionReceivingChange(receiving: Boolean) {}
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState) {}
        override fun onIceCandidate(candidate: IceCandidate) {}
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>) {}
        override fun onAddStream(stream: MediaStream) {}
        override fun onRemoveStream(stream: MediaStream) {}
        override fun onDataChannel(channel: DataChannel) {}
        override fun onRenegotiationNeeded() {}
    }

    private open class SdpObserverAdapter : SdpObserver {
        override fun onCreateSuccess(desc: SessionDescription) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(error: String?) {}
        override fun onSetFailure(error: String?) {}
    }
}
