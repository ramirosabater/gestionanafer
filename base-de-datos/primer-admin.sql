-- ============================================================
-- PRIMER ADMINISTRADOR — se corre UNA vez, después de schema.sql.
--
-- 1) Reemplazá las dos apariciones de TU-EMAIL por el email con el que
--    entrás (el mismo del tablero Comercial).
-- 2) Si todavía no tenés cuenta con ese email: Supabase → Authentication →
--    Users → Add user → Create new user (email + contraseña).
-- 3) Run.
--
-- Te deja con el perfil 'admin' de ⚙ → Acceso. Desde ahí, en ⚙ → Acceso →
-- Usuarios, después agregás al resto y les elegís el perfil.
-- ============================================================
update usuarios set perfil = 'admin', activo = true
where email = lower('TU-EMAIL');

insert into usuarios (email, activo, perfil)
select lower('TU-EMAIL'), true, 'admin'
where not exists (select 1 from usuarios where email = lower('TU-EMAIL'));

-- Control: tiene que aparecer tu email con perfil admin
select email, activo, perfil from usuarios order by email;
