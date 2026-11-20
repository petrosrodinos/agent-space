package com.agentspace.app.widgets

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.agentspace.app.core.NativeSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.util.concurrent.TimeUnit

/**
 * Keeps the "approvals waiting" widget current: `GET /approvals` (pending only) with the stored sign-in, every
 * 15 minutes (WorkManager's minimum) while a widget is on the home screen, plus right after an approval push.
 */
class ApprovalsCountWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    companion object {
        private const val PERIODIC = "approvals-count-periodic"
        private const val ONE_SHOT = "approvals-count-now"
        private const val PERIOD_MINUTES = 15L
        private const val APPROVALS_PATH = "/approvals?status=pending"
        private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedule(context: Context) {
            val req = PeriodicWorkRequestBuilder<ApprovalsCountWorker>(PERIOD_MINUTES, TimeUnit.MINUTES).setConstraints(online).build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP, req)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(PERIODIC)
        }

        /** Refreshes once now, only when a widget is placed. */
        fun refreshNow(context: Context) {
            if (!ApprovalsWidget.hasInstances(context)) return
            val req = OneTimeWorkRequestBuilder<ApprovalsCountWorker>().setConstraints(online).build()
            WorkManager.getInstance(context).enqueueUniqueWork(ONE_SHOT, ExistingWorkPolicy.REPLACE, req)
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val ctx = applicationContext
        if (!NativeSession.isSignedIn(ctx)) {
            ApprovalsWidget.store(ctx, null)
            return@withContext Result.success()
        }
        try {
            val res = NativeSession.request(ctx, "GET", APPROVALS_PATH)
            if (!res.ok) return@withContext if (res.status >= 500) Result.retry() else Result.success()
            ApprovalsWidget.store(ctx, JSONArray(res.body).length())
            Result.success()
        } catch (e: NativeSession.NotSignedInException) {
            ApprovalsWidget.store(ctx, null)
            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
