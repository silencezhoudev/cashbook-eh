import swaggerJsdoc from "swagger-jsdoc";
import options from "../../swagger.config";

let swaggerSpec: ReturnType<typeof swaggerJsdoc> | null = null;

export const getSwaggerSpec = () => {
  if (!swaggerSpec) {
    swaggerSpec = swaggerJsdoc(options);
  }
  return swaggerSpec;
};

