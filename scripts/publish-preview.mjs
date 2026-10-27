// Retired release-era safety guard. Historical fixture builders remain read-only.
if(process.argv.length!==3||process.argv[2]!=='--push')throw new Error('Publikacja wymaga jawnego --push; publikowanie preview jest wyłączone.');
throw new Error('Publikowanie etapowych preview zakończone. Produkcję wdraża wyłącznie workflow po zielonych Tests na aktualnym main.');
