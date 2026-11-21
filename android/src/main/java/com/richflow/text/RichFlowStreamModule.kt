package com.richflow.text

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RichFlowStreamModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RichFlowStream")
    View(PlainTextStreamView::class) {
      Events("onSelectionChange", "onHeightChange", "onResync")
      Prop("updateJson") { view: PlainTextStreamView, value: String -> view.pendingUpdate = value }
      Prop("configJson") { view: PlainTextStreamView, value: String -> view.setConfig(value) }
      Prop("contentWidth") { view: PlainTextStreamView, value: Double -> view.contentWidth = value }
      Prop("selectable") { view: PlainTextStreamView, value: Boolean -> view.selectable = value }
      OnViewDidUpdateProps { view: PlainTextStreamView -> view.commit() }
    }
  }
}
