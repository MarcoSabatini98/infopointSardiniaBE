// Cache-Control di default: le risposte API non vanno cache-ate dai browser/proxy
// (i dati cambiano e l'auth è per-utente). I singoli handler che servono dati
// pubblici "lenti" possono sovrascrivere l'header con un max-age esplicito.
function cacheControl(_req, res, next) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

module.exports = cacheControl;
