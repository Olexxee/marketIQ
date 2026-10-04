import { asyncWrapper } from "../../lib/asyncWrapper.js";
import { successResponse } from "../../lib/response.js";

import {
  onboardSeller,
  getSellerProfile,
  updateSellerProfile,
  createSellerLocation,
  getSellerLocations,
  getSellerLocation,
  updateSellerLocation,
  deleteSellerLocation,
} from "./seller.service.js";

export const onboard = asyncWrapper(async (req, res) => {
  const seller = await onboardSeller(req.user.id, req.body);

  return successResponse({
    res,
    statusCode: 201,
    message: "Seller profile created successfully",
    data: seller,
  });
});

export const getMe = asyncWrapper(async (req, res) => {
  const seller = await getSellerProfile(req.user.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Seller profile retrieved successfully",
    data: seller,
  });
});

export const updateMe = asyncWrapper(async (req, res) => {
  const seller = await updateSellerProfile(req.user.id, req.body);

  return successResponse({
    res,
    statusCode: 200,
    message: "Seller profile updated successfully",
    data: seller,
  });
});

export const createLocation = asyncWrapper(async (req, res) => {
  const location = await createSellerLocation(req.user.id, req.body);

  return successResponse({
    res,
    statusCode: 201,
    message: "Business location created successfully",
    data: location,
  });
});

export const listLocations = asyncWrapper(async (req, res) => {
  const locations = await getSellerLocations(req.user.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Business locations retrieved successfully",
    data: locations,
  });
});

export const getLocation = asyncWrapper(async (req, res) => {
  const location = await getSellerLocation(req.user.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Business location retrieved successfully",
    data: location,
  });
});

export const updateLocation = asyncWrapper(async (req, res) => {
  const location = await updateSellerLocation(
    req.user.id,
    req.params.id,
    req.body,
  );

  return successResponse({
    res,
    statusCode: 200,
    message: "Business location updated successfully",
    data: location,
  });
});

export const deleteLocation = asyncWrapper(async (req, res) => {
  await deleteSellerLocation(req.user.id, req.params.id);

  return successResponse({
    res,
    statusCode: 200,
    message: "Business location deleted successfully",
  });
});
