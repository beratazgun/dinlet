#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/ca4c333c1d0e73746d13d0c2fd895277e7961027871b85eb32c7515afa422009/contract';
import endContract from '../../snapshots/ca4c333c1d0e73746d13d0c2fd895277e7961027871b85eb32c7515afa422009/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f3215e4458437e77f1669342b73a5db109c6177278e616f70cc7bbe08d6c8080/contract';
import startContract from '../../snapshots/f3215e4458437e77f1669342b73a5db109c6177278e616f70cc7bbe08d6c8080/contract.json' with { type: 'json' };
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
      this.createTable({
        schema: 'public',
        table: 'store_bundle_items',
        columns: [
          col('bundle_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('store_item_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'store_bundles',
        columns: [
          col('category_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('is_published', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('price_try', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('product_id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'store_categories',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('parent_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'store_entitlements',
        columns: [
          col('bundle_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('product_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('revoked_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('store', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('store_item_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('transaction_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('user_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'store_entitlements_source_check_67a9d6e5',
            "\"source\" IN ('FREE', 'PURCHASE', 'GRANT')",
          ),
          checkExpression(
            'store_entitlements_store_check_7b73277d',
            "\"store\" IN ('APP_STORE', 'PLAY_STORE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'store_item_categories',
        columns: [
          col('category_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('store_item_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'store_items',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('credit', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('document_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('is_featured', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('is_published', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('price_try', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('product_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('published_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('publisher_name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sample_sections', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'store_items_source_check_3cece20d',
            "\"source\" IN ('ORIGINAL', 'LEGISLATION', 'PUBLISHER', 'PUBLIC_DOMAIN')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'documents',
        column: col('store_item_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'documents', column: 'media_id' }),
      this.addUnique({
        schema: 'public',
        table: 'store_bundle_items',
        constraint: 'store_bundle_items_bundle_id_store_item_id_key',
        columns: ['bundle_id', 'store_item_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'store_bundles',
        constraint: 'store_bundles_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'store_bundles',
        constraint: 'store_bundles_product_id_key',
        columns: ['product_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'store_categories',
        constraint: 'store_categories_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'store_entitlements',
        constraint: 'store_entitlements_user_id_store_item_id_key',
        columns: ['user_id', 'store_item_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'store_item_categories',
        constraint: 'store_item_categories_store_item_id_category_id_key',
        columns: ['store_item_id', 'category_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'store_items',
        constraint: 'store_items_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'store_items',
        constraint: 'store_items_document_id_key',
        columns: ['document_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'store_items',
        constraint: 'store_items_product_id_key',
        columns: ['product_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'documents',
        index: 'documents_store_item_id_idx_2ecdf496',
        columns: ['store_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'documents',
        index: 'documents_user_id_store_item_id_idx_d9e6762a',
        columns: ['user_id', 'store_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_bundle_items',
        index: 'store_bundle_items_bundle_id_idx_e7f515f1',
        columns: ['bundle_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_bundle_items',
        index: 'store_bundle_items_store_item_id_idx_2ecdf496',
        columns: ['store_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_bundles',
        index: 'store_bundles_category_id_idx_da7213d4',
        columns: ['category_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_bundles',
        index: 'store_bundles_category_id_position_idx_2b65690d',
        columns: ['category_id', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_categories',
        index: 'store_categories_parent_id_idx_ab33b399',
        columns: ['parent_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_categories',
        index: 'store_categories_parent_id_position_idx_f79cd3a2',
        columns: ['parent_id', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_entitlements',
        index: 'store_entitlements_bundle_id_idx_e7f515f1',
        columns: ['bundle_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_entitlements',
        index: 'store_entitlements_store_item_id_idx_2ecdf496',
        columns: ['store_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_entitlements',
        index: 'store_entitlements_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_entitlements',
        index: 'store_entitlements_user_id_product_id_idx_9740c8e0',
        columns: ['user_id', 'product_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_item_categories',
        index: 'store_item_categories_category_id_idx_da7213d4',
        columns: ['category_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_item_categories',
        index: 'store_item_categories_store_item_id_idx_2ecdf496',
        columns: ['store_item_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'store_items',
        index: 'store_items_is_published_position_idx_2613af79',
        columns: ['is_published', 'position'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_bundle_items',
        foreignKey: {
          name: 'store_bundle_items_bundle_id_fkey',
          columns: ['bundle_id'],
          references: { schema: 'public', table: 'store_bundles', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_bundle_items',
        foreignKey: {
          name: 'store_bundle_items_store_item_id_fkey',
          columns: ['store_item_id'],
          references: { schema: 'public', table: 'store_items', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_bundles',
        foreignKey: {
          name: 'store_bundles_category_id_fkey',
          columns: ['category_id'],
          references: { schema: 'public', table: 'store_categories', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_categories',
        foreignKey: {
          name: 'store_categories_parent_id_fkey',
          columns: ['parent_id'],
          references: { schema: 'public', table: 'store_categories', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_entitlements',
        foreignKey: {
          name: 'store_entitlements_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_entitlements',
        foreignKey: {
          name: 'store_entitlements_store_item_id_fkey',
          columns: ['store_item_id'],
          references: { schema: 'public', table: 'store_items', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_entitlements',
        foreignKey: {
          name: 'store_entitlements_bundle_id_fkey',
          columns: ['bundle_id'],
          references: { schema: 'public', table: 'store_bundles', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_item_categories',
        foreignKey: {
          name: 'store_item_categories_store_item_id_fkey',
          columns: ['store_item_id'],
          references: { schema: 'public', table: 'store_items', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_item_categories',
        foreignKey: {
          name: 'store_item_categories_category_id_fkey',
          columns: ['category_id'],
          references: { schema: 'public', table: 'store_categories', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'store_items',
        foreignKey: {
          name: 'store_items_document_id_fkey',
          columns: ['document_id'],
          references: { schema: 'public', table: 'documents', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'documents',
        foreignKey: {
          name: 'documents_store_item_id_fkey',
          columns: ['store_item_id'],
          references: { schema: 'public', table: 'store_items', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
