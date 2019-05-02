const sketch = require("sketch");
const UI = require("sketch/ui");
const { Library } = require("sketch/dom");
const {
  buildDialog,
  buildLabel,
  buildPopUpButton,
  addSubview
} = require("./ui-utils");

const pluginName = "Library Replacer";

const getLibraryTypeName = function(library) {
  switch (library.libraryType) {
    case Library.LibraryType.Internal:
      return "Internal";
    case Library.LibraryType.User:
      return "Local";
    case Library.LibraryType.Remote:
      return "Sketch Cloud";
  }
};

const replaceSymbols = function(document, fromLibraryId, toLibrary) {
  const overridesById = new Map();
  const docSymbols = document.getSymbols();
  let allSymbolInstances = [];
  const symbolsMap = new Map();

  if (!docSymbols.length) {
    return { symbolsMap, symbolInstances: allSymbolInstances };
  }

  const libSymbols = toLibrary.getImportableSymbolReferencesForDocument(
    document
  );
  let libSymbolsByName = new Map();
  libSymbols.forEach(libSymbol => {
    libSymbolsByName.set(libSymbol.name, libSymbol);
  });

  docSymbols.forEach(docSymbolMaster => {
    const library = docSymbolMaster.getLibrary();
    if (!library || getLibraryId(library) !== fromLibraryId) {
      return;
    }
    const libSymbol = libSymbolsByName.get(docSymbolMaster.name);
    if (!libSymbol) {
      return;
    }

    const importedSymbolMaster = libSymbol.import();
    symbolsMap.set(docSymbolMaster.symbolId, importedSymbolMaster.symbolId);

    const symbolInstances = docSymbolMaster.getAllInstances();
    allSymbolInstances = allSymbolInstances.concat(symbolInstances);
    symbolInstances.forEach(symbolInstance => {
      overridesById.set(symbolInstance.id, symbolInstance.overrides);
      symbolInstance.symbolId = importedSymbolMaster.symbolId;
    });

    docSymbolMaster.parent = null;
  });

  return { symbolsMap, symbolInstances: allSymbolInstances, overridesById };
};

const replaceSharedStyles = function(
  docSharedStyles,
  libSharedStyles,
  fromLibraryId
) {
  const sharedStylesMap = new Map();

  const libSharedStylesByName = new Map();
  libSharedStyles.forEach(libSharedStyle => {
    libSharedStylesByName.set(libSharedStyle.name, libSharedStyle);
  });

  docSharedStyles.forEach(docSharedStyle => {
    const library = docSharedStyle.getLibrary();
    if (!library || getLibraryId(library) !== fromLibraryId) {
      return;
    }

    const libSharedStyle = libSharedStylesByName.get(docSharedStyle.name);
    if (!libSharedStyle) {
      return;
    }

    const importedSharedStyle = libSharedStyle.import();
    sharedStylesMap.set(docSharedStyle.id, importedSharedStyle.id);
    docSharedStyle.getAllInstancesLayers().forEach(layer => {
      layer.sharedStyleId = importedSharedStyle.id;
      layer.style.syncWithSharedStyle(importedSharedStyle);
    });
  });

  return sharedStylesMap;
};

const updateSymbolsOverrides = function(
  symbolInstances,
  overridesById,
  symbolsMap,
  layerStylesMap,
  textStylesMap
) {
  symbolInstances.forEach(symbolInstance => {
    const overrides = overridesById.get(symbolInstance.id);
    overrides.forEach(override => {
      switch (override.property) {
        case "symbolID":
          if (symbolsMap.has(override.value)) {
            override.value = symbolsMap.get(override.value);
          }
          break;

        case "layerStyle":
          if (layerStylesMap.has(override.value)) {
            override.value = layerStylesMap.get(override.value);
          }
          break;

        case "textStyle":
          if (textStylesMap.has(override.value)) {
            override.value = textStylesMap.get(override.value);
          }
          break;
      }
    });
  });
};

const getImportableSharedStyles = function(
  importableObjectType,
  document,
  library
) {
  switch (importableObjectType) {
    case Library.ImportableObjectType.LayerStyle:
      return library.getImportableLayerStyleReferencesForDocument(document);

    case Library.ImportableObjectType.TextStyle:
      return library.getImportableTextStyleReferencesForDocument(document);
  }
};

const replaceLibrary = function(document, fromLibraryId, toLibrary) {
  const { symbolsMap, symbolInstances, overridesById } = replaceSymbols(
    document,
    fromLibraryId,
    toLibrary
  );

  const importableLayerStyles = getImportableSharedStyles(
    Library.ImportableObjectType.LayerStyle,
    document,
    toLibrary
  );
  const layerStylesMap = replaceSharedStyles(
    document.sharedLayerStyles,
    importableLayerStyles,
    fromLibraryId
  );

  const importableTextStyles = getImportableSharedStyles(
    Library.ImportableObjectType.TextStyle,
    document,
    toLibrary
  );
  const textStylesMap = replaceSharedStyles(
    document.sharedTextStyles,
    importableTextStyles,
    fromLibraryId
  );

  updateSymbolsOverrides(
    symbolInstances,
    overridesById,
    symbolsMap,
    layerStylesMap,
    textStylesMap
  );
  document.sketchObject.reloadInspector();
};

const getReferencedLibrariesForSymbols = function(document, librariesById) {
  document.getSymbols().forEach(symbolMaster => {
    const library = symbolMaster.getLibrary();
    if (!library) return;

    librariesById.set(getLibraryId(library), library);
  });
};

const getReferencedLibrariesForSharedStyles = function(
  sharedStyles,
  librariesById
) {
  sharedStyles.forEach(sharedStyle => {
    const library = sharedStyle.getLibrary();
    if (!library) return;

    librariesById.set(getLibraryId(library), library);
  });
};

const getCurrentlyReferencedLibraries = function(document) {
  const librariesById = new Map();
  getReferencedLibrariesForSymbols(document, librariesById);
  getReferencedLibrariesForSharedStyles(
    document.sharedLayerStyles,
    librariesById
  );
  getReferencedLibrariesForSharedStyles(
    document.sharedTextStyles,
    librariesById
  );
  return Array.from(librariesById.values());
};

const getLibraryId = function(library) {
  return library
    ? `${library.id}.${library.name}.${library.libraryType}`
    : null;
};

const getLibraryNames = function(libraries) {
  return libraries.map(
    library => `${library.name} (${getLibraryTypeName(library)})`
  );
};

const filterLibraries = function(libraries, library) {
  return libraries.filter(
    itLibrary =>
      !(itLibrary.name === library.name && itLibrary.id === library.id)
  );
};

const buildMainDialog = function(fromLibraries, toLibraries) {
  const width = 250;
  const height = fromLibraries.length > 1 ? 98 : 25;
  let y = height;
  const view = NSView.alloc().initWithFrame(NSMakeRect(0, 0, width, height));
  let fromLibraryPopUpBtn, toLibraryPopUpBtn;
  if (fromLibraries.length > 1) {
    y = addSubview(
      buildLabel(0, y - 17, width, 17, "From Library", 12),
      view,
      3,
      y
    );
    fromLibraryPopUpBtn = buildPopUpButton(
      0,
      y - 25,
      width,
      25,
      getLibraryNames(fromLibraries)
    );
    fromLibraryPopUpBtn.setCOSJSTargetFunction(dropDown => {
      const fromLibrary = fromLibraries[dropDown.indexOfSelectedItem()];
      toLibraryPopUpBtn.removeAllItems();
      toLibraryPopUpBtn.addItemsWithTitles(
        getLibraryNames(filterLibraries(toLibraries, fromLibrary))
      );
    });
    y = addSubview(fromLibraryPopUpBtn, view, 8, y);
    y = addSubview(
      buildLabel(0, y - 17, 200, 17, "Replace with Library", 12),
      view,
      3,
      y
    );
  }
  toLibraryPopUpBtn = buildPopUpButton(
    0,
    y - 25,
    width,
    25,
    getLibraryNames(filterLibraries(toLibraries, fromLibraries[0]))
  );
  view.addSubview(toLibraryPopUpBtn);
  const text =
    fromLibraries.length > 1
      ? "Replace instances of shared Symbols and Styles."
      : `Replace instances of shared Symbols and Styles from “${
          fromLibraries[0].name
        }” with:`;
  return {
    dialog: buildDialog(pluginName, text, "Replace", view),
    fromLibraryPopUpBtn,
    toLibraryPopUpBtn
  };
};

export default function() {
  const document = sketch.getSelectedDocument();
  const sortFunc = (library1, library2) => {
    return library1.name.localeCompare(library2.name);
  };
  const fromLibraries = getCurrentlyReferencedLibraries(document).sort(
    sortFunc
  );
  if (fromLibraries.length === 0) {
    UI.alert(
      pluginName,
      "No instances of shared Symbols and Styles to replace."
    );
    return;
  }
  const toLibraries = sketch
    .getLibraries()
    .filter(library => library.valid && library.enabled)
    .sort(sortFunc);
  const { dialog, fromLibraryPopUpBtn, toLibraryPopUpBtn } = buildMainDialog(
    fromLibraries,
    toLibraries
  );
  if (dialog.runModal() === NSAlertFirstButtonReturn) {
    const fromLibrary =
      fromLibraries.length === 1
        ? fromLibraries[0]
        : fromLibraries[fromLibraryPopUpBtn.indexOfSelectedItem()];
    const toLibrary = filterLibraries(toLibraries, fromLibrary)[
      toLibraryPopUpBtn.indexOfSelectedItem()
    ];
    replaceLibrary(document, getLibraryId(fromLibrary), toLibrary);

    UI.message(
      `Replaced instances using “${fromLibrary.name}” with “${toLibrary.name}.”`
    );
  }
}
