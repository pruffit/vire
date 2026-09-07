import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

/**
 * Величины из макета — ПРОПОРЦИИ, а не абсолютные dp.
 *
 * Стенд материала (`apps/web/rnd-src/scenes.ts`) нарисован на экране шириной 300. Телефон
 * шире (411 у Pixel 7), и перенесённое сырым числом поле в 20 занимает там не 6.7 % ширины,
 * а 4.9 % — вся композиция выходит мельче макета, хотя каждое число совпадает. Поэтому
 * геометрия и кегли пересчитываются от ширины экрана, а не берутся как есть.
 */
export const MOCK_WIDTH = 300;

export function mockScale(width: number): number {
  return width / MOCK_WIDTH;
}

/** Пересчёт одной величины макета под текущий экран. */
export function useMock(): (value: number) => number {
  const { width } = useWindowDimensions();
  const k = mockScale(width);
  return (value: number) => Math.round(value * k);
}

/**
 * Материал в том же масштабе, что и геометрия.
 *
 * `thickness` и `bevel` — причины в dp, и от габарита детали они не зависят. Но габарит
 * ЗАВИСИТ от экрана: деталь, выросшая в 1.37 раза с прежней фаской, отдаёт кромке меньшую
 * долю своего полуразмера, и та читается тоньше и тусклее нарисованной. Раз пропорции
 * переносятся целиком, вместе с ними обязана переноситься и толщина стекла.
 *
 * `film` не масштабируется: это толщина плёнки в нанометрах, физика света, а не раскладка.
 */
export function scaleMaterial<T extends { thickness: number; bevel: number }>(material: T, k: number): T {
  return { ...material, thickness: material.thickness * k, bevel: material.bevel * k };
}

export function useMockMaterial<T extends { thickness: number; bevel: number }>(material: T): T {
  const { width } = useWindowDimensions();
  const k = mockScale(width);
  return useMemo(() => scaleMaterial(material, k), [material, k]);
}
