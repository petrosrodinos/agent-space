package com.agentspace.app.widgets

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.widget.RemoteViews
import com.agentspace.app.R
import com.agentspace.app.core.DeepLinks

/** Home-screen widgets (§14.2): quick-ask, voice mode and the number of approvals waiting. */
private fun actionWidget(context: Context, manager: AppWidgetManager, ids: IntArray, iconRes: Int, label: String, url: String) {
    for (id in ids) {
        val views = RemoteViews(context.packageName, R.layout.widget_action).apply {
            setImageViewResource(R.id.widget_icon, iconRes)
            setTextViewText(R.id.widget_label, label)
            setOnClickPendingIntent(R.id.widget_root, DeepLinks.open(context, url))
        }
        manager.updateAppWidget(id, views)
    }
}

class QuickAskWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) =
        actionWidget(context, manager, ids, R.drawable.ic_widget_message, context.getString(R.string.widget_quick_ask_label), DeepLinks.ASK)
}

class VoiceWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) =
        actionWidget(context, manager, ids, R.drawable.ic_widget_mic, context.getString(R.string.widget_voice_label), DeepLinks.VOICE)
}

class ApprovalsWidget : AppWidgetProvider() {
    companion object {
        private const val PREFS = "agentspace.widgets"
        private const val KEY_COUNT = "approvals_count"
        private const val UNKNOWN = -1

        fun hasInstances(context: Context) = AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, ApprovalsWidget::class.java)).isNotEmpty()

        /** Saves the latest count (null = signed out / unknown) and redraws every instance. */
        fun store(context: Context, count: Int?) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt(KEY_COUNT, count ?: UNKNOWN).apply()
            val manager = AppWidgetManager.getInstance(context)
            render(context, manager, manager.getAppWidgetIds(ComponentName(context, ApprovalsWidget::class.java)))
        }

        private fun render(context: Context, manager: AppWidgetManager, ids: IntArray) {
            val count = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt(KEY_COUNT, UNKNOWN)
            val label = when {
                count == UNKNOWN -> context.getString(R.string.widget_approvals_signed_out)
                count == 1 -> context.getString(R.string.widget_approvals_one)
                else -> context.getString(R.string.widget_approvals_many)
            }
            for (id in ids) {
                val views = RemoteViews(context.packageName, R.layout.widget_approvals).apply {
                    setTextViewText(R.id.widget_count, if (count == UNKNOWN) context.getString(R.string.widget_count_unknown) else count.toString())
                    setTextViewText(R.id.widget_label, label)
                    setOnClickPendingIntent(R.id.widget_root, DeepLinks.open(context, DeepLinks.APPROVALS))
                }
                manager.updateAppWidget(id, views)
            }
        }
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        render(context, manager, ids)
        ApprovalsCountWorker.schedule(context)
        ApprovalsCountWorker.refreshNow(context)
    }

    override fun onEnabled(context: Context) = ApprovalsCountWorker.schedule(context)

    override fun onDisabled(context: Context) = ApprovalsCountWorker.cancel(context)
}
