package com.ventlog.free;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

/** A light home-screen shortcut, not a background microphone or recording service. */
public final class VentlogWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_VOICE = "com.ventlog.free.action.WIDGET_VOICE";
    public static final String ACTION_TYPE = "com.ventlog.free.action.WIDGET_TYPE";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        super.onUpdate(context, manager, widgetIds);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        Intent voice = new Intent(context, MainActivity.class);
        voice.setAction(ACTION_VOICE);
        voice.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent voiceAction = PendingIntent.getActivity(context, 701, voice, flags);

        Intent type = new Intent(context, MainActivity.class);
        type.setAction(ACTION_TYPE);
        type.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent typeAction = PendingIntent.getActivity(context, 702, type, flags);

        for (int widgetId : widgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.ventlog_widget);
            views.setOnClickPendingIntent(R.id.widget_root, voiceAction);
            views.setOnClickPendingIntent(R.id.widget_type, typeAction);
            manager.updateAppWidget(widgetId, views);
        }
    }
}
