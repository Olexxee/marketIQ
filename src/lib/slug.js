export const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Resolve a unique slug.
 *
 * existsFn(slug) must return the existing row (with `.id`) or null.
 * currentId allows the caller's own row to be ignored during updates.
 */
export const generateUniqueSlug = async ({
  name,
  providedSlug,
  currentId = null,
  existsFn,
}) => {
  const base = slugify(providedSlug || name);

  if (!base) {
    throw new Error("A valid slug could not be generated");
  }

  let slug = base;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await existsFn(slug);

    if (!existing || existing.id === currentId) {
      return slug;
    }

    counter += 1;
    slug = `${base}-${counter}`;
  }
};
