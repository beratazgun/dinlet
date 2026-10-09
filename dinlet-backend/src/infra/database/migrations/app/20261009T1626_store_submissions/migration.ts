#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/b3254be54b7b6f3f1735af5953d10336e6d2f8cd72ef2db8e565fce8f53bd0fd/contract';
import startContract from '../../snapshots/b3254be54b7b6f3f1735af5953d10336e6d2f8cd72ef2db8e565fce8f53bd0fd/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fc7c08934f1315d71634744e5ee04130bb485d43efb3648d9040bfa67c44b488/contract';
import endContract from '../../snapshots/fc7c08934f1315d71634744e5ee04130bb485d43efb3648d9040bfa67c44b488/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'notifications',
        constraint: 'notifications_entity_type_check_7aa73585',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'notifications',
        constraint: 'notifications_type_check_db261f90',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'store_items',
        constraint: 'store_items_source_check_3cece20d',
      }),
      this.createTable({
        schema: 'public',
        table: 'store_submissions',
        columns: [
          col('category_ids', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('document_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('rejection_reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reviewed_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('reviewed_by', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('rights_confirmed_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('store_item_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'store_submissions_status_check_9a526491',
            "\"status\" IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'documents',
        column: col('is_store_master', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'store_items',
        column: col('author_user_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'notifications',
        constraint: 'notifications_entity_type_check_b15fe126',
        expression: "\"entity_type\" IN ('Document', 'StoreSubmission')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'notifications',
        constraint: 'notifications_type_check_7c1fb41b',
        expression:
          "\"type\" IN ('PASSWORD_CHANGED', 'ACCOUNT_LOCKED', 'NEW_DEVICE_LOGIN', 'DOCUMENT_READY', 'DOCUMENT_FAILED', 'STORE_SUBMISSION_APPROVED', 'STORE_SUBMISSION_REJECTED')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'store_items',
        constraint: 'store_items_source_check_5723d97c',
        expression:
          "\"source\" IN ('ORIGINAL', 'LEGISLATION', 'PUBLISHER', 'PUBLIC_DOMAIN', 'COMMUNITY')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_items',
        index: 'store_items_author_user_id_idx_591a807e',
        columns: ['author_user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_submissions',
        index: 'store_submissions_document_id_idx_d3d0944e',
        columns: ['document_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_submissions',
        index: 'store_submissions_status_created_at_idx_1bbe8adf',
        columns: ['status', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_submissions',
        index: 'store_submissions_store_item_id_idx_2ecdf496',
        columns: ['store_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_submissions',
        index: 'store_submissions_user_id_created_at_idx_b562028f',
        columns: ['user_id', 'created_at'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_submissions',
        index: 'store_submissions_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_items',
        foreignKey: {
          name: 'store_items_author_user_id_fkey',
          columns: ['author_user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_submissions',
        foreignKey: {
          name: 'store_submissions_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_submissions',
        foreignKey: {
          name: 'store_submissions_document_id_fkey',
          columns: ['document_id'],
          references: { schema: 'public', table: 'documents', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_submissions',
        foreignKey: {
          name: 'store_submissions_store_item_id_fkey',
          columns: ['store_item_id'],
          references: { schema: 'public', table: 'store_items', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
