

export const getPaginationParams = (page = 1, limit = 10) => {
  const parsedPage = Math.max(Number(page) || 1, 1);

  const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
    take: parsedLimit,
  };
};

export const formatPaginatedResponse = ({
  data = [],
  total = 0,
  page = 1,
  limit = 10,
}) => {
  const parsedPage = Math.max(Number(page) || 1, 1);

  const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

  const totalPages = Math.ceil(total / parsedLimit);

  return {
    data,

    meta: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages,

      hasNextPage: parsedPage < totalPages,
      hasPrevPage: parsedPage > 1,

      nextPage: parsedPage < totalPages ? parsedPage + 1 : null,

      prevPage: parsedPage > 1 ? parsedPage - 1 : null,
    },
  };
};

export const buildPaginationMeta = ({ total = 0, page = 1, limit = 10 }) => {
  const parsedPage = Math.max(Number(page) || 1, 1);

  const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

  const totalPages = Math.ceil(total / parsedLimit);

  return {
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages,

    hasNextPage: parsedPage < totalPages,
    hasPrevPage: parsedPage > 1,

    nextPage: parsedPage < totalPages ? parsedPage + 1 : null,

    prevPage: parsedPage > 1 ? parsedPage - 1 : null,
  };
};

export const buildCursorPaginationMeta = ({
  limit = 10,
  hasNextPage = false,
  nextCursor = null,
  prevCursor = null,
}) => {
  const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

  return {
    limit: parsedLimit,
    hasNextPage,
    hasPrevPage: Boolean(prevCursor),

    nextCursor,
    prevCursor,
  };
};
