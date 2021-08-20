export const schema: Record<string, any> = {
  type: 'object',
  required: ['comment'],
  maxProperties: 1,
  minProperties: 1,
  properties: {
    comment: {
      type: 'string',
      pattern: '[a-zA-Z0-9\\s,@.]+$',
    },
  },
};
