#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0fc115b5dbd1f1fdcae7cb734a99040ef0e995719b30f51136e45af19b1f28e5/contract';
import endContract from '../../snapshots/0fc115b5dbd1f1fdcae7cb734a99040ef0e995719b30f51136e45af19b1f28e5/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7bd5c07998f74949973af246a933c7c0654cd0c097942cd58e4889c57ec9f67e/contract';
import startContract from '../../snapshots/7bd5c07998f74949973af246a933c7c0654cd0c097942cd58e4889c57ec9f67e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'document_tags',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('document_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tag_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'folders',
        columns: [
          col('color', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', {
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
        table: 'study_goals',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('exam_date', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('exam_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
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
        table: 'tags',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
        table: 'documents',
        column: col('folder_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'documents',
        column: col('is_favorite', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'document_tags',
        constraint: 'document_tags_document_id_tag_id_key',
        columns: ['document_id', 'tag_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'folders',
        constraint: 'folders_user_id_name_key',
        columns: ['user_id', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'study_goals',
        constraint: 'study_goals_user_id_key',
        columns: ['user_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'tags',
        constraint: 'tags_user_id_name_key',
        columns: ['user_id', 'name'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'document_tags',
        index: 'document_tags_document_id_idx_d3d0944e',
        columns: ['document_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'document_tags',
        index: 'document_tags_tag_id_idx_94b47830',
        columns: ['tag_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'documents',
        index: 'documents_folder_id_idx_61252c35',
        columns: ['folder_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'folders',
        index: 'folders_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'folders',
        index: 'folders_user_id_position_idx_cf338b13',
        columns: ['user_id', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tags',
        index: 'tags_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'document_tags',
        foreignKey: {
          name: 'document_tags_document_id_fkey',
          columns: ['document_id'],
          references: { schema: 'public', table: 'documents', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'document_tags',
        foreignKey: {
          name: 'document_tags_tag_id_fkey',
          columns: ['tag_id'],
          references: { schema: 'public', table: 'tags', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'folders',
        foreignKey: {
          name: 'folders_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'documents',
        foreignKey: {
          name: 'documents_folder_id_fkey',
          columns: ['folder_id'],
          references: { schema: 'public', table: 'folders', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'study_goals',
        foreignKey: {
          name: 'study_goals_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tags',
        foreignKey: {
          name: 'tags_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
