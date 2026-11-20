package com.agentspace.app.voice

import android.Manifest
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * `@agentspace/voice` (§14.2): native voice mode for the web app (app/src/platform/mobile-voice.ts).
 *
 * Flow: `start({ title, micEnabled })` → `{ sdp }` (offer) → JS posts it to `POST /voice/sessions` → `setAnswer({ sdp })`.
 * Events: `connection` { state }, `message` { data } (raw data-channel JSON), `speaking` { who: user|bot|none },
 * `level` { level 0..1 }, `ended` { reason }.
 */
@CapacitorPlugin(
    name = "AgentSpaceVoice",
    permissions = [Permission(alias = VoicePlugin.MICROPHONE, strings = [Manifest.permission.RECORD_AUDIO])],
)
class VoicePlugin : Plugin() {
    companion object {
        const val MICROPHONE = "microphone"
        private object Events {
            const val CONNECTION = "connection"
            const val MESSAGE = "message"
            const val SPEAKING = "speaking"
            const val LEVEL = "level"
            const val ENDED = "ended"
        }
        private const val ENDED_BY_NOTIFICATION = "notification"
        private const val ENDED_BY_APP = "app"
    }

    override fun load() {
        VoiceEngine.listener = object : VoiceEngine.Listener {
            override fun onConnectionState(state: String) = notifyListeners(Events.CONNECTION, JSObject().put("state", state))
            override fun onMessage(json: String) = notifyListeners(Events.MESSAGE, JSObject().put("data", json))
            override fun onSpeaking(who: String) = notifyListeners(Events.SPEAKING, JSObject().put("who", who))
            override fun onLevel(level: Double) = notifyListeners(Events.LEVEL, JSObject().put("level", level))
        }
        VoiceService.onEndedFromNotification = { notifyListeners(Events.ENDED, JSObject().put("reason", ENDED_BY_NOTIFICATION)) }
    }

    override fun handleOnDestroy() {
        VoiceEngine.listener = null
        VoiceService.onEndedFromNotification = null
        super.handleOnDestroy()
    }

    /** `{ title?, url?, micEnabled? }` → `{ sdp }`. Asks for the microphone first if needed. */
    @PluginMethod
    fun start(call: PluginCall) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            requestPermissionForAlias(MICROPHONE, call, "microphonePermissionCallback")
            return
        }
        begin(call)
    }

    @PermissionCallback
    fun microphonePermissionCallback(call: PluginCall) {
        if (getPermissionState(MICROPHONE) == PermissionState.GRANTED) begin(call) else call.reject("Microphone access is needed for voice mode", "MIC_DENIED")
    }

    private fun begin(call: PluginCall) {
        // Foreground service first: Android 14 only lets a microphone service start while the app is in front.
        VoiceService.start(context, call.getString("title") ?: "Voice mode is on", call.getString("url"))
        VoiceEngine.createOffer(context, call.getBoolean("micEnabled", true) ?: true) { sdp, error ->
            if (sdp != null) {
                call.resolve(JSObject().put("sdp", sdp))
            } else {
                VoiceService.stop(context)
                call.reject(error ?: "Could not start voice mode")
            }
        }
    }

    @PluginMethod
    fun setAnswer(call: PluginCall) {
        val sdp = call.getString("sdp") ?: return call.reject("Missing sdp")
        VoiceEngine.setAnswer(sdp) { error -> if (error == null) call.resolve() else call.reject(error) }
    }

    /** `{ data }` = a JSON string for the data channel → `{ sent }`. */
    @PluginMethod
    fun send(call: PluginCall) {
        val data = call.getString("data") ?: return call.reject("Missing data")
        call.resolve(JSObject().put("sent", VoiceEngine.send(data)))
    }

    @PluginMethod
    fun setMicEnabled(call: PluginCall) {
        VoiceEngine.setMicEnabled(call.getBoolean("enabled", true) ?: true)
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val wasActive = VoiceEngine.active
        VoiceEngine.stop()
        VoiceService.stop(context)
        if (wasActive) notifyListeners(Events.ENDED, JSObject().put("reason", ENDED_BY_APP))
        call.resolve()
    }
}
