import Ajv from 'ajv';

export function validate(obj: Record<string, any>, schema: Record<string, any>): void | Error {
  const ajv = new Ajv({
    allErrors: true,
  });

  const validator: Ajv.ValidateFunction = ajv.compile(schema);
  const valid = validator(obj) as boolean;

  if (!valid) {
    const errorMessage = `Invalid: ${ajv.errorsText(validator.errors)}`;
    throw new Error(errorMessage);
  }
}
