/**
 * Рендерит блок Schema.org JSON-LD. Серверный компонент: безопасно
 * сериализует данные и экранирует `<` (защита от инъекции закрывающего
 * тега `</script>` в пользовательских строках — bio, названия).
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
