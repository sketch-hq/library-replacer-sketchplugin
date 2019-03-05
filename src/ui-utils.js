export function buildDialog(messageText, informativeText, buttonTitle, accessoryView) {
  const dialog = COSAlertWindow.new()
  dialog.setMessageText(messageText)
  dialog.setInformativeText(informativeText)
  dialog.setIcon(NSImage.alloc().initByReferencingFile(context.plugin.urlForResourceNamed('icon.png').path()))
  dialog.addAccessoryView(accessoryView)
  dialog.addButtonWithTitle(buttonTitle)
  dialog.addButtonWithTitle('Cancel')
  return dialog
}

export function buildLabel(x, y, width, height, text, fontSize) {
  const label = NSTextField.alloc().initWithFrame(NSMakeRect(x, y, width, height))
  label.stringValue = text
  label.font = NSFont.boldSystemFontOfSize(fontSize)
  label.bezeled = false
  label.drawBackground = false
  label.editable = false
  label.selectable = false
  label.backgroundColor = NSColor.colorWithWhite_alpha(1, 0)
  return label
}

export function buildPopUpButton(x, y, width, height, titles, selectedIndex = undefined) {
  const popUpBtn = NSPopUpButton.alloc().initWithFrame_pullsDown(NSMakeRect(x, y, width, height), false)
  popUpBtn.addItemsWithTitles(titles)
  if (selectedIndex != null) {
    popUpBtn.selectItemAtIndex(selectedIndex)
  }
  return popUpBtn
}

export function addSubview(subview, view, verticalSpace, y = view.frame().size.height) {
  view.addSubview(subview)
  return y - subview.frame().size.height - verticalSpace
}