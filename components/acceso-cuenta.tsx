'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabaseNavegador } from '@/lib/supabase/browser';

export function AccesoCuenta({
  configurado,
  errorInicial,
}: {
  configurado: boolean;
  errorInicial?: string;
}) {
  const router = useRouter();
  const cliente = useMemo(
    () => (configurado ? crearClienteSupabaseNavegador() : null),
    [configurado],
  );
  const [email, setEmail] = useState('');
  const [usuario, setUsuario] = useState<string | null | undefined>(configurado ? undefined : null);
  const [mensaje, setMensaje] = useState(errorInicial ?? '');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!cliente) return;
    let activo = true;
    void cliente.auth.getUser().then(({ data }) => {
      if (activo) setUsuario(data.user?.email ?? null);
    });
    return () => {
      activo = false;
    };
  }, [cliente]);

  if (!configurado) {
    return (
      <section className="app-panel account-card" id="contenido">
        <h2>Modo local activo</h2>
        <p>La aplicación sigue guardando reglas, plantillas y resúmenes en este navegador. No hace falta iniciar sesión.</p>
      </section>
    );
  }

  const pedirEnlace = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (!cliente) return;
    setEnviando(true);
    setMensaje('');
    const retorno = new URL('/auth/callback', window.location.origin);
    retorno.searchParams.set('next', '/historial');
    const { error } = await cliente.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: retorno.toString(), shouldCreateUser: true },
    });
    setMensaje(
      error
        ? `No pudimos enviar el enlace: ${error.message}`
        : 'Revisá tu correo. El enlace de acceso vence y puede usarse una sola vez.',
    );
    setEnviando(false);
  };

  const cerrarSesion = async () => {
    if (!cliente) return;
    setEnviando(true);
    const { error } = await cliente.auth.signOut();
    setMensaje(error ? `No pudimos cerrar la sesión: ${error.message}` : 'Sesión cerrada.');
    setUsuario(null);
    setEnviando(false);
    router.refresh();
  };

  return (
    <section className="app-panel account-card" id="contenido">
      {usuario === undefined ? (
        <p aria-live="polite">Comprobando la sesión…</p>
      ) : usuario ? (
        <>
          <p className="eyebrow">Sesión activa</p>
          <h2>{usuario}</h2>
          <p>Las reglas, plantillas y conciliaciones resumidas pertenecen a tu organización.</p>
          <button className="button button-secondary" type="button" disabled={enviando} onClick={() => void cerrarSesion()}>
            Cerrar sesión
          </button>
        </>
      ) : (
        <form onSubmit={(evento) => void pedirEnlace(evento)}>
          <h2>Recibí un enlace de acceso</h2>
          <p>No necesitás contraseña. Si es tu primer ingreso, se crea tu organización y quedás como owner.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" required value={email} onChange={(evento) => setEmail(evento.target.value)} />
          </label>
          <button className="button button-primary" type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar magic link'}
          </button>
        </form>
      )}
      {mensaje ? <div className={mensaje.startsWith('No pudimos') ? 'error-box' : 'success-box'} role="status">{mensaje}</div> : null}
    </section>
  );
}
