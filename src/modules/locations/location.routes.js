import { Router } from "express";
import {
  listCountries,
  showCountry,
  listStates,
  showState,
  listLgas,
  showLga,
  listCities,
  showCity,
} from "./location.controller.js";
import {
  idParamSchema,
  countryIdParamSchema,
  stateIdParamSchema,
  lgaIdParamSchema,
} from "./location.validation.js";
import { validateParams } from "../../middlewares/validateMiddleware.js";



const locationRouter = Router();

locationRouter.get("/countries", listCountries);

locationRouter.get("/countries/:id", validateParams(idParamSchema), showCountry);

locationRouter.get(
  "/countries/:countryId/states",
  validateParams(countryIdParamSchema),
  listStates,
);

locationRouter.get("/states/:id", validateParams(idParamSchema), showState);

locationRouter.get(
  "/states/:stateId/lgas",
  validateParams(stateIdParamSchema),
  listLgas,
);

locationRouter.get("/lgas/:id", validateParams(idParamSchema), showLga);

locationRouter.get("/lgas/:lgaId/cities", validateParams(lgaIdParamSchema), listCities);

locationRouter.get("/cities/:id", validateParams(idParamSchema), showCity);

export default locationRouter;
