package com.agentspace.app.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * The app's stored sign-in, shared by the web app and the native extras (lock-screen approvals, widgets).
 *
 * - The refresh token lives only here (AES-GCM with a key in the Android Keystore). The web app reads and writes it
 *   through the AgentSpace plugin (app/src/platform/native.ts `storage.getRefreshToken/setRefreshToken`), so there
 *   is exactly one copy — refresh tokens rotate on every use (api/src/modules/auth/auth.service.ts `refresh`).
 * - The web app also mirrors its current access token, its expiry, the API address and the selected organisation
 *   here, so native code only refreshes when the access token has expired (normally: the app isn't running).
 */
object NativeSession {
    private const val PREFS = "agentspace.native_session"
    private const val KEY_ALIAS = "agentspace.native_session.v1"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val GCM_TAG_BITS = 128
    private const val EXPIRY_MARGIN_MS = 30_000L
    private const val TIMEOUT_MS = 15_000

    private object Keys {
        const val API_URL = "api_url"
        const val ORGANIZATION_ID = "organization_id"
        const val ACCESS_TOKEN = "access_token"
        const val ACCESS_EXPIRES_AT = "access_expires_at"
        const val REFRESH_TOKEN = "refresh_token"
    }

    /** Matches api/src/modules/auth: native clients get the rotated refresh token in the body, not a cookie. */
    private const val CLIENT_PLATFORM = "android"
    private const val REFRESH_PATH = "/auth/refresh"

    class ApiResponse(val status: Int, val body: String) {
        val ok get() = status in 200..299
    }

    class NotSignedInException : Exception("Not signed in")

    private val lock = Any()

    private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey()
    }

    private fun put(context: Context, name: String, value: String?) {
        val editor = prefs(context).edit()
        if (value.isNullOrEmpty()) {
            editor.remove(name)
        } else {
            val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key()) }
            val sealed = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
            editor.putString(name, Base64.encodeToString(sealed, Base64.NO_WRAP))
        }
        editor.apply()
    }

    private fun get(context: Context, name: String): String? {
        val stored = prefs(context).getString(name, null) ?: return null
        return try {
            val sealed = Base64.decode(stored, Base64.NO_WRAP)
            val iv = sealed.copyOfRange(0, 12)
            val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(GCM_TAG_BITS, iv)) }
            String(cipher.doFinal(sealed.copyOfRange(12, sealed.size)), Charsets.UTF_8)
        } catch (e: Exception) {
            // Key lost (e.g. the user removed the screen lock on some devices): treat as signed out.
            null
        }
    }

    fun setSession(context: Context, apiUrl: String?, organizationId: String?, accessToken: String?, accessExpiresAtMs: Long?) = synchronized(lock) {
        put(context, Keys.API_URL, apiUrl?.trimEnd('/'))
        put(context, Keys.ORGANIZATION_ID, organizationId)
        put(context, Keys.ACCESS_TOKEN, accessToken)
        prefs(context).edit().putLong(Keys.ACCESS_EXPIRES_AT, accessExpiresAtMs ?: 0L).apply()
    }

    fun refreshToken(context: Context): String? = synchronized(lock) { get(context, Keys.REFRESH_TOKEN) }

    fun setRefreshToken(context: Context, token: String?) = synchronized(lock) { put(context, Keys.REFRESH_TOKEN, token) }

    fun organizationId(context: Context): String? = get(context, Keys.ORGANIZATION_ID)

    fun isSignedIn(context: Context) = refreshToken(context) != null && get(context, Keys.API_URL) != null

    fun clear(context: Context) = synchronized(lock) { prefs(context).edit().clear().apply() }

    /** A valid access token, refreshing with the stored refresh token when needed. Call off the main thread. */
    @Throws(NotSignedInException::class)
    fun accessToken(context: Context): String {
        synchronized(lock) { return accessTokenLocked(context) }
    }

    private fun accessTokenLocked(context: Context): String {
        val current = get(context, Keys.ACCESS_TOKEN)
        val expiresAt = prefs(context).getLong(Keys.ACCESS_EXPIRES_AT, 0L)
        if (current != null && expiresAt - System.currentTimeMillis() > EXPIRY_MARGIN_MS) return current
        val apiUrl = get(context, Keys.API_URL) ?: throw NotSignedInException()
        val refresh = get(context, Keys.REFRESH_TOKEN) ?: throw NotSignedInException()
        val res = send("$apiUrl$REFRESH_PATH", "POST", JSONObject().put("refresh_token", refresh).toString(), null, null)
        if (res.status == 400 || res.status == 401) {
            // The session ended (expired, signed out elsewhere): forget it so widgets stop polling — unless the web
            // app stored a newer token meanwhile (it rotated first), in which case that one is still good.
            if (get(context, Keys.REFRESH_TOKEN) == refresh) {
                put(context, Keys.REFRESH_TOKEN, null)
                put(context, Keys.ACCESS_TOKEN, null)
            }
            throw NotSignedInException()
        }
        if (!res.ok) throw IllegalStateException("Refresh failed (${res.status})")
        val json = JSONObject(res.body)
        val token = json.getString("access_token")
        put(context, Keys.ACCESS_TOKEN, token)
        prefs(context).edit().putLong(Keys.ACCESS_EXPIRES_AT, json.optLong("expires_in", 0L) * 1000L).apply()
        json.optString("refresh_token").takeIf { it.isNotEmpty() }?.let { put(context, Keys.REFRESH_TOKEN, it) }
        return token
    }

    /** Calls the API as the signed-in user. [path] starts with "/" and is relative to the API URL (which ends in /api). */
    @Throws(NotSignedInException::class)
    fun request(context: Context, method: String, path: String, body: JSONObject? = null, organizationId: String? = null): ApiResponse {
        val apiUrl = get(context, Keys.API_URL) ?: throw NotSignedInException()
        val org = organizationId ?: get(context, Keys.ORGANIZATION_ID)
        return send("$apiUrl$path", method, body?.toString(), accessToken(context), org)
    }

    private fun send(url: String, method: String, body: String?, bearer: String?, organizationId: String?): ApiResponse {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = TIMEOUT_MS
            conn.readTimeout = TIMEOUT_MS
            conn.setRequestProperty("Accept", "application/json")
            conn.setRequestProperty("X-Client-Platform", CLIENT_PLATFORM)
            bearer?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
            organizationId?.let { conn.setRequestProperty("X-Organization-Id", it) }
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = conn.responseCode
            val stream = if (status >= 400) conn.errorStream else conn.inputStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            return ApiResponse(status, text)
        } finally {
            conn.disconnect()
        }
    }
}
