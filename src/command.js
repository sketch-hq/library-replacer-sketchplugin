const sketch = require('sketch')
const UI = require('sketch/ui')
const { Library } = require('sketch/dom')

const getLibraryTypeName = function(library) {
  switch (library.libraryType) {
    case Library.LibraryType.Internal: return 'Internal'
    case Library.LibraryType.User: return 'Local'
    case Library.LibraryType.Remote: return 'Sketch Cloud'
  }
}

const replaceSymbols = function(document, library) {
  const overridesById = new Map()
  const docSymbols = document.getSymbols()
  let allSymbolInstances = []
  const symbolsMap = new Map()

  if (!docSymbols.length) {
    return {symbolsMap, symbolInstances: allSymbolInstances}
  }

  const libSymbols = library.getImportableSymbolReferencesForDocument(document)
  let libSymbolsByName = new Map()
  libSymbols.forEach(libSymbol => {
    libSymbolsByName.set(libSymbol.name, libSymbol)
  })

  docSymbols.forEach(docSymbolMaster => {
    if (!docSymbolMaster.getLibrary()) {
      return
    }
    const libSymbol = libSymbolsByName.get(docSymbolMaster.name)
    if (!libSymbol) {
      return
    }

    const importedSymbolMaster = libSymbol.import()
    symbolsMap.set(docSymbolMaster.symbolId, importedSymbolMaster.symbolId)

    const symbolInstances = docSymbolMaster.getAllInstances()
    allSymbolInstances = allSymbolInstances.concat(symbolInstances)
    symbolInstances.forEach(symbolInstance => {
      overridesById.set(symbolInstance.id, symbolInstance.overrides)
      symbolInstance.master = importedSymbolMaster
    })

    docSymbolMaster.parent = null
  })

  return {symbolsMap, symbolInstances: allSymbolInstances, overridesById}
}

const replaceSharedStyles = function(docSharedStyles, libSharedStyles) {
  const sharedStylesMap = new Map()

  const libSharedStylesByName = new Map()
  libSharedStyles.forEach(libSharedStyle => {
    libSharedStylesByName.set(libSharedStyle.name, libSharedStyle)
  })

  docSharedStyles.forEach(docSharedStyle => {
    if (!docSharedStyle.getLibrary()) {
      return
    }
    const libSharedStyle = libSharedStylesByName.get(docSharedStyle.name)
    if (!libSharedStyle) {
      return
    }
    const importedSharedStyle = libSharedStyle.import()
    sharedStylesMap.set(docSharedStyle.id, importedSharedStyle.id)
    docSharedStyle.getAllInstancesLayers().forEach(layer => {
      layer.sharedStyleId = importedSharedStyle.id
      layer.style.syncWithSharedStyle(importedSharedStyle)
    })
  })

  return sharedStylesMap
}

const updateSymbolsOverrides = function(symbolInstances, overridesById, symbolsMap, layerStylesMap, textStylesMap) {
  symbolInstances.forEach(symbolInstance => {
    const overrides = overridesById.get(symbolInstance.id)
    overrides.forEach(override => {
      switch (override.property) {
        case 'symbolID':
          if (symbolsMap.has(override.value)) {
            override.value = symbolsMap.get(override.value)
          }
          break;

        case 'layerStyle':
          if (layerStylesMap.has(override.value)) {
            override.value = layerStylesMap.get(override.value)
          }
          break;

        case 'textStyle':
          if (textStylesMap.has(override.value)) {
            override.value = textStylesMap.get(override.value)
          }
          break;
      }
    })
  })
}

const getImportableSharedStyles = function(importableObjectType, document, library) {
  switch (importableObjectType) {
    case Library.ImportableObjectType.LayerStyle:
      return library.getImportableLayerStyleReferencesForDocument(document)

    case Library.ImportableObjectType.TextStyle:
      return library.getImportableTextStyleReferencesForDocument(document)
  }
}

const replaceWithLibrary = function(document, library) {
  const { symbolsMap, symbolInstances, overridesById } = replaceSymbols(document, library)

  const importableLayerStyles = getImportableSharedStyles(Library.ImportableObjectType.LayerStyle, document, library)
  const layerStylesMap = replaceSharedStyles(document.sharedLayerStyles, importableLayerStyles)

  const importableTextStyles = getImportableSharedStyles(Library.ImportableObjectType.TextStyle, document, library)
  const textStylesMap = replaceSharedStyles(document.sharedTextStyles, importableTextStyles)

  updateSymbolsOverrides(symbolInstances, overridesById, symbolsMap, layerStylesMap, textStylesMap)
  document.sketchObject.reloadInspector()
}

export default function() {
  const libraries = sketch.getLibraries().filter(library => library.valid && library.enabled).sort((library1, library2) => {
    return library1.name.localeCompare(library2.name)
  })
  const libraryLabels = libraries.map(library => `${library.name} (${getLibraryTypeName(library)})`)

  UI.getInputFromUser('Select the new library you want to replace with', {
    type: UI.INPUT_TYPE.selection,
    possibleValues: libraryLabels
  }, (error, value) => {
    if (!error) {
      replaceWithLibrary(sketch.getSelectedDocument(), libraries[libraryLabels.indexOf(value)])
    }
  })
}