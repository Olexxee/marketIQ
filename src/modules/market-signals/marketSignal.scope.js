export const buildScopeKey = ({ countryId, stateId, lgaId, cityId } = {}) => {
  if (cityId) return `CITY:${cityId}`;
  if (lgaId) return `LGA:${lgaId}`;
  if (stateId) return `STATE:${stateId}`;
  if (countryId) return `COUNTRY:${countryId}`;
  return "GLOBAL";
};

export const parseScopeKey = (scopeKey) => {
  if (!scopeKey || scopeKey === "GLOBAL") {
    return { level: "GLOBAL", id: null };
  }

  const [level, id] = scopeKey.split(":");
  return { level, id };
};
