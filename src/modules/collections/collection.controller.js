import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";
import { buildPaginationMeta, getPagination } from "../../lib/pagination.js";
import {
  createCollectionService,
  deleteCollectionService,
  getCollectionService,
  listCollectionsService,
  updateCollectionService,
} from "./collection.service.js";



export const createCollection = asyncWrapper(async (req, res) => {
  const collection = await createCollectionService(req.body);
  return successResponse({
    res,
    statusCode: 201,
    message: "Collection created successfully",
    data: collection,
  });
});

export const getCollections = asyncWrapper(async (req, res) => {
  const { page, limit, skip, take } = getPagination(req.query);
  const { isActive, search } = req.query;
  const { collections, total } = await listCollectionsService({
    isActive,
    search,
    skip,
    take,
  });

  return successResponse({
    res,
    statusCode: 200,
    message: "Collections retrieved successfully",
    data: collections,
    meta: buildPaginationMeta({
      page,
      limit,
      total,
    }),
  });
});

export const getCollection = asyncWrapper(async (req, res) => {
  const collection = await getCollectionService(req.params.id);
  return successResponse({
    res,
    statusCode: 200,
    message: "Collection retrieved successfully",
    data: collection,
  });
});

export const updateCollection = asyncWrapper(async (req, res) => {
  const collection = await updateCollectionService(req.params.id, req.body);
  return successResponse({
    res,
    statusCode: 200,
    message: "Collection updated successfully",
    data: collection,
  });
});

export const deleteCollection = asyncWrapper(async (req, res) => {
  await deleteCollectionService(req.params.id);
  return successResponse({
    res,
    statusCode: 200,
    message: "Collection deleted successfully",
    data: null,
  });
});
