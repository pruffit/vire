import { z } from 'zod';

// Протокол экрана: сервер решает состав и порядок, клиент — только рендер.
// Правила эволюции — docs/sdui.md §5: новый тип блока можно, новое обязательное
// поле props нельзя, смена смысла поля — никогда.

export const dataSourceSchema = z.union([
  z.object({ kind: z.literal('inline'), data: z.unknown() }),
  z.object({
    kind: z.literal('endpoint'),
    endpoint: z.string().min(1),
    params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  }),
]);
export type DataSource = z.infer<typeof dataSourceSchema>;

/** Раскладка — только из перечисления: свободная строка класса дала бы способ обойти инварианты оболочки. */
export const blockLayoutSchema = z.enum(['row', 'grid', 'list']);

const blockBase = {
  id: z.string().min(1),
  source: dataSourceSchema.optional(),
};

const titledProps = z.object({
  title: z.string().optional(),
  href: z.string().optional(),
  hrefLabel: z.string().optional(),
  layout: blockLayoutSchema.optional(),
  limit: z.number().int().positive().optional(),
});

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ ...blockBase, type: z.literal('featured-release'), props: z.object({}).default({}) }),
  z.object({ ...blockBase, type: z.literal('flow'), props: z.object({}).default({}) }),
  z.object({ ...blockBase, type: z.literal('personal'), props: z.object({}).default({}) }),
  z.object({ ...blockBase, type: z.literal('feed'), props: z.object({}).default({}) }),
  z.object({ ...blockBase, type: z.literal('friends-activity'), props: z.object({}).default({}) }),
  z.object({ ...blockBase, type: z.literal('hot-tracks'), props: titledProps.default({}) }),
  z.object({ ...blockBase, type: z.literal('fresh-releases'), props: titledProps.default({}) }),
  z.object({ ...blockBase, type: z.literal('upcoming'), props: z.object({}).default({}) }),
  z.object({ ...blockBase, type: z.literal('listening-now'), props: z.object({}).default({}) }),
  z.object({ ...blockBase, type: z.literal('playlists'), props: titledProps.default({}) }),
  z.object({ ...blockBase, type: z.literal('artists'), props: titledProps.default({}) }),
  z.object({ ...blockBase, type: z.literal('discovery'), props: z.object({}).default({}) }),
  z.object({ ...blockBase, type: z.literal('catalog-empty-notice'), props: z.object({}).default({}) }),
]);
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block['type'];

export const screenSchema = z.object({
  screen: z.string().min(1),
  version: z.number().int().positive(),
  revision: z.string().min(1),
  blocks: z.array(blockSchema),
});
export type Screen = z.infer<typeof screenSchema>;
