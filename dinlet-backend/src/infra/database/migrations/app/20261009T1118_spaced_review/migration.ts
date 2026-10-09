#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/0fc115b5dbd1f1fdcae7cb734a99040ef0e995719b30f51136e45af19b1f28e5/contract';
import startContract from '../../snapshots/0fc115b5dbd1f1fdcae7cb734a99040ef0e995719b30f51136e45af19b1f28e5/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/24fa83726969eb3630ff5cbaacf37aa73453003dd5710a2be2d8cceb21703b2d/contract';
import endContract from '../../snapshots/24fa83726969eb3630ff5cbaacf37aa73453003dd5710a2be2d8cceb21703b2d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'quiz_questions',
        columns: [
          col('answer', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('answer_audio_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('answer_duration_ms', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('detail', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('order', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('question', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('question_audio_key', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('question_duration_ms', 'int4', {
            notNull: true,
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('section_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'review_days',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('day', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reviewed_sections', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'review_items',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('due_on', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('graduated', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('last_reviewed_on', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('section_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('stage', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'sections',
        column: col('recap_audio_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sections',
        column: col('recap_duration_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'quiz_questions',
        constraint: 'quiz_questions_section_id_order_key',
        columns: ['section_id', 'order'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'review_days',
        constraint: 'review_days_user_id_day_key',
        columns: ['user_id', 'day'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'review_items',
        constraint: 'review_items_user_id_section_id_key',
        columns: ['user_id', 'section_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'quiz_questions',
        index: 'quiz_questions_section_id_idx_13db6de7',
        columns: ['section_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'review_days',
        index: 'review_days_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'review_items',
        index: 'review_items_section_id_idx_13db6de7',
        columns: ['section_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'review_items',
        index: 'review_items_user_id_graduated_due_on_idx_64fbc4ad',
        columns: ['user_id', 'graduated', 'due_on'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'review_items',
        index: 'review_items_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'quiz_questions',
        foreignKey: {
          name: 'quiz_questions_section_id_fkey',
          columns: ['section_id'],
          references: { schema: 'public', table: 'sections', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'review_days',
        foreignKey: {
          name: 'review_days_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'review_items',
        foreignKey: {
          name: 'review_items_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'review_items',
        foreignKey: {
          name: 'review_items_section_id_fkey',
          columns: ['section_id'],
          references: { schema: 'public', table: 'sections', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
