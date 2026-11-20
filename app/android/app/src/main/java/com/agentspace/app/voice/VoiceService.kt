package com.agentspace.app.voice

import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.agentspace.app.R
import com.agentspace.app.core.Channels
import com.agentspace.app.core.DeepLinks

/**
 * Keeps voice mode alive while the screen is locked or the app is in the background (§7.6): a foreground service
 * of type microphone + media playback with an ongoing "Voice mode is on" notification (End button), a partial
 * wake lock and the call audio mode on the speaker. The WebRTC connection itself lives in [VoiceEngine].
 */
class VoiceService : Service() {
    companion object {
        private const val ACTION_START = "com.agentspace.app.voice.START"
        private const val ACTION_END = "com.agentspace.app.voice.END"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_URL = "url"
        private const val NOTIFICATION_ID = 0x7601
        private const val WAKE_LOCK_TAG = "agentspace:voice"
        private const val WAKE_LOCK_MAX_MS = 2 * 60 * 60 * 1000L

        /** Called by the plugin when it ended because the user tapped End in the notification. */
        @Volatile var onEndedFromNotification: (() -> Unit)? = null

        fun start(context: Context, title: String, url: String?) {
            val intent = Intent(context, VoiceService::class.java).setAction(ACTION_START).putExtra(EXTRA_TITLE, title).putExtra(EXTRA_URL, url)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, VoiceService::class.java))
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var focus: AudioFocusRequest? = null
    private var previousMode = AudioManager.MODE_NORMAL

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_END) {
            VoiceEngine.stop()
            onEndedFromNotification?.invoke()
            stopSelf()
            return START_NOT_STICKY
        }
        Channels.ensure(this)
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Voice mode is on"
        val url = intent?.getStringExtra(EXTRA_URL)
        val end = PendingIntent.getService(this, 1, Intent(this, VoiceService::class.java).setAction(ACTION_END), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, Channels.VOICE)
            .setSmallIcon(R.drawable.ic_stat_agentspace)
            .setContentTitle(title)
            .setContentText("Talking with your bot. Tap to open.")
            .setContentIntent(DeepLinks.open(this, url?.let(DeepLinks::fromPath) ?: DeepLinks.VOICE))
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(0, "End", end)
            .build()
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
        acquire()
        return START_NOT_STICKY
    }

    private fun acquire() {
        if (wakeLock == null) {
            wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
                setReferenceCounted(false)
                acquire(WAKE_LOCK_MAX_MS)
            }
        }
        val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (focus == null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                .build()
            audio.requestAudioFocus(req)
            focus = req
        }
        if (audio.mode != AudioManager.MODE_IN_COMMUNICATION) previousMode = audio.mode
        audio.mode = AudioManager.MODE_IN_COMMUNICATION
        @Suppress("DEPRECATION")
        audio.isSpeakerphoneOn = true
    }

    override fun onDestroy() {
        VoiceEngine.stop()
        val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        @Suppress("DEPRECATION")
        audio.isSpeakerphoneOn = false
        audio.mode = previousMode
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) focus?.let { audio.abandonAudioFocusRequest(it) }
        focus = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        super.onDestroy()
    }
}
