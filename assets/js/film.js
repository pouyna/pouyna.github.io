/* Film state for the "Grow the Film" game. Pure ALD chemistry, no DOM.
   UMD-ish: browser global `Film`, CommonJS for node --test. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.Film = factory(); }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GREEN = 0;
  var DEFECT = 1;
  var BLUE = 'blue';
  var YELLOW = 'yellow';

  function create(cols) {
    var columns = [];
    var terms = [];
    for (var i = 0; i < cols; i++) { columns.push([]); terms.push(YELLOW); }
    return { cols: cols, columns: columns, terms: terms, good: 0, defects: 0 };
  }

  function clampCol(film, col) {
    if (col < 0) return 0;
    if (col > film.cols - 1) return film.cols - 1;
    return col;
  }

  function height(film, col) {
    return film.columns[col].length;
  }

  function cellAt(film, col, row) {
    return film.columns[col][row];
  }

  function termination(film, col) {
    return film.terms[clampCol(film, col)];
  }

  function canReact(film, col, species) {
    return film.terms[clampCol(film, col)] !== species;
  }

  function minHeight(film) {
    if (film.cols === 0) return 0;
    var m = film.columns[0].length;
    for (var i = 1; i < film.cols; i++) {
      if (film.columns[i].length < m) m = film.columns[i].length;
    }
    return m;
  }

  function maxHeight(film) {
    if (film.cols === 0) return 0;
    var m = film.columns[0].length;
    for (var i = 1; i < film.cols; i++) {
      if (film.columns[i].length > m) m = film.columns[i].length;
    }
    return m;
  }

  function react(film, col, species) {
    col = clampCol(film, col);
    film.columns[col].push(GREEN);
    film.good += 1;
    film.terms[col] = species;
  }

  function depositDefect(film, col) {
    col = clampCol(film, col);
    film.columns[col].push(DEFECT);
    film.defects += 1;
    film.terms[col] = YELLOW;
  }

  function purity(film) {
    var total = film.good + film.defects;
    return total === 0 ? 1 : film.good / total;
  }

  function avgLayers(film) {
    if (film.cols === 0) return 0;
    return (film.good + film.defects) / film.cols;
  }

  function resize(film, newCols) {
    var next = create(newCols);
    if (film.cols === 0) return next;
    for (var i = 0; i < newCols; i++) {
      var src = Math.min(film.cols - 1, Math.floor(i * film.cols / newCols));
      var cells = film.columns[src].slice();
      next.columns[i] = cells;
      next.terms[i] = film.terms[src];
      for (var j = 0; j < cells.length; j++) {
        if (cells[j] === DEFECT) next.defects += 1;
        else next.good += 1;
      }
    }
    return next;
  }

  function reset(film) {
    for (var i = 0; i < film.cols; i++) {
      film.columns[i] = [];
      film.terms[i] = YELLOW;
    }
    film.good = 0;
    film.defects = 0;
  }

  return {
    GREEN: GREEN,
    DEFECT: DEFECT,
    BLUE: BLUE,
    YELLOW: YELLOW,
    create: create,
    canReact: canReact,
    react: react,
    depositDefect: depositDefect,
    height: height,
    cellAt: cellAt,
    termination: termination,
    minHeight: minHeight,
    maxHeight: maxHeight,
    purity: purity,
    avgLayers: avgLayers,
    resize: resize,
    reset: reset
  };
});
