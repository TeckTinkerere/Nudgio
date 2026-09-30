package com.aslam.mediareminder.alarm

/** No continuous ringing without a visible notification/action surface. */
object NotificationDeliveryPolicy {
    fun canAlert(appEnabled: Boolean, channelImportance: Int?, groupBlocked: Boolean): Boolean =
        appEnabled && channelImportance != null && channelImportance > 0 && !groupBlocked
}
