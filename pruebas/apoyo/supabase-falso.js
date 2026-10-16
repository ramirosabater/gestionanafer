// Reemplazo de supabase-js para las pruebas: una base en memoria.
// Los datos iniciales vienen en window.__DB (los pone la prueba) y todo lo que
// la app escribe queda en window.__S.escrituras = [[tabla, accion, datos], ...].
(function () {
  var DB = window.__DB || {};
  var S = (window.__S = { escrituras: [] });
  var SESION_KEY = "prueba_sesion_email";
  function sesion() {
    var e = null;
    try { e = localStorage.getItem(SESION_KEY); } catch (err) {}
    return e ? { user: { email: e }, access_token: "token-prueba" } : null;
  }
  function filas(t) { return (DB[t] = DB[t] || []); }
  function clave(t, fila) { return fila.id != null ? "id" : (fila.email != null ? "email" : (fila.codigo != null ? "codigo" : "id")); }
  function guardar(t, datos) {
    (Array.isArray(datos) ? datos : [datos]).forEach(function (fila) {
      var k = clave(t, fila), lista = filas(t);
      var i = lista.findIndex(function (x) { return x[k] === fila[k]; });
      if (i >= 0) lista[i] = Object.assign({}, lista[i], fila); else lista.push(Object.assign({}, fila));
    });
  }
  function consulta(t) {
    var q = { filtros: [], accion: null, datos: null };
    ["select", "order", "limit", "in", "neq", "gte", "lte", "is", "not", "or", "match", "filter", "ilike", "single", "maybeSingle"]
      .forEach(function (m) { q[m] = function () { return q; }; });
    q.range = function (desde) { q.desde = desde; return q; };
    q.eq = function (c, v) { q.filtros.push([c, v]); return q; };
    ["upsert", "insert", "update", "delete"].forEach(function (m) {
      q[m] = function (d) { q.accion = m; q.datos = d; return q; };
    });
    q.then = function (ok, ko) {
      var r;
      if (q.accion) {
        S.escrituras.push([t, q.accion, q.datos, q.filtros.slice()]);
        if (q.accion === "upsert" || q.accion === "insert") guardar(t, q.datos);
        if (q.accion === "update") filas(t).forEach(function (f) { if (q.filtros.every(function (x) { return f[x[0]] === x[1]; })) Object.assign(f, q.datos); });
        if (q.accion === "delete") DB[t] = filas(t).filter(function (f) { return !q.filtros.every(function (x) { return f[x[0]] === x[1]; }); });
        r = { data: null, error: null };
      } else if (DB.__errores && DB.__errores[t]) {
        r = { data: null, error: { message: DB.__errores[t] } };
      } else if (q.desde) {
        r = { data: [], error: null }; // fetchAllRows: segunda página vacía
      } else {
        var lista = filas(t).filter(function (f) { return q.filtros.every(function (x) { return f[x[0]] === x[1]; }); });
        r = { data: JSON.parse(JSON.stringify(lista)), error: null };
      }
      return Promise.resolve(r).then(ok, ko);
    };
    return q;
  }
  window.supabase = {
    createClient: function () {
      var canal = { on: function () { return canal; }, subscribe: function () { return canal; } };
      return {
        from: consulta,
        channel: function () { return canal; },
        removeChannel: function () {},
        rpc: function () { return Promise.resolve({ data: null, error: null }); },
        // Edge Functions: la respuesta la pone la prueba en DB.__funciones[nombre]
        functions: { invoke: function (nombre, op) {
          S.escrituras.push(["__funciones", nombre, (op || {}).body]);
          var r = (DB.__funciones || {})[nombre];
          if (r) return Promise.resolve(JSON.parse(JSON.stringify(r)));
          return Promise.resolve({ data: null, error: { message: "Function not found", context: { status: 404, json: function () { return Promise.resolve({ error: "not found" }); } } } });
        } },
        storage: { from: function () { return { upload: function () { return Promise.resolve({}); }, getPublicUrl: function () { return { data: {} }; } }; } },
        auth: {
          getSession: function () { return Promise.resolve({ data: { session: sesion() } }); },
          signInWithPassword: function (o) {
            var u = (DB.__cuentas || {})[String(o.email).toLowerCase()];
            if (u === undefined || u !== o.password) return Promise.resolve({ data: { session: null }, error: { message: "Invalid login credentials" } });
            try { localStorage.setItem(SESION_KEY, String(o.email).toLowerCase()); } catch (err) {}
            return Promise.resolve({ data: { session: sesion() }, error: null });
          },
          signUp: function () { return Promise.resolve({ data: {}, error: { message: "Signups not allowed for this instance", code: "signup_disabled" } }); },
          signOut: function () { try { localStorage.removeItem(SESION_KEY); } catch (err) {} return Promise.resolve({}); },
          onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
        },
      };
    },
  };
})();
