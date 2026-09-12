/**
 * One place that serialises structured data.
 *
 * Everything that emits JSON-LD goes through here so the escaping is done
 * once: a `<` inside a string value would otherwise close the script element
 * early, which both breaks the page and is an injection vector the moment any
 * of this data comes from the database — and it does, on therapist profiles.
 */
export default function JsonLd({ data }: { readonly data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
