# Seguridad

## Reportar una vulnerabilidad

No abras un issue público con detalles explotables. Escribinos por el canal de contacto de RAON
indicado en el README con una descripción, pasos de reproducción, impacto estimado y una forma
segura de contactarte. Vamos a confirmar la recepción y coordinar la divulgación responsable.

## Alcance y datos

Los archivos bancarios se procesan localmente. No incluyas datos reales de clientes, credenciales,
extractos ni secretos en reportes, pruebas o capturas. Los datos del repositorio son inventados.

La IA está apagada por defecto. Cuando se habilita, `/api/ia` recibe únicamente los campos mínimos
de los casos dudosos y sus candidatos; nunca recibe los archivos. Las claves del proveedor son
secretos del servidor y no deben usar el prefijo `NEXT_PUBLIC_`. Las pruebas usan un proveedor
falso y no hacen solicitudes a servicios de IA.
