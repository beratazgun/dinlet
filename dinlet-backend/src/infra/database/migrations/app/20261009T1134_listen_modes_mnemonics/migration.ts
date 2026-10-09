#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/24fa83726969eb3630ff5cbaacf37aa73453003dd5710a2be2d8cceb21703b2d/contract';
import startContract from '../../snapshots/24fa83726969eb3630ff5cbaacf37aa73453003dd5710a2be2d8cceb21703b2d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f3215e4458437e77f1669342b73a5db109c6177278e616f70cc7bbe08d6c8080/contract';
import endContract from '../../snapshots/f3215e4458437e77f1669342b73a5db109c6177278e616f70cc7bbe08d6c8080/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'mnemonics',
        columns: [
          col('audio_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dismissed', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('document_id', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('duration_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('explanation', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('hook', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kept', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('position', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('section_id', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('topic', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'documents',
        column: col('mnemonic_status', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sections',
        column: col('quick_audio_key', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sections',
        column: col('quick_duration_ms', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sections',
        column: col('quick_script', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sections',
        column: col('quick_script_hash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'sections',
        column: col('quick_status', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'documents',
        constraint: 'documents_mnemonic_status_check_e8ec3e19',
        expression: "\"mnemonic_status\" IN ('PENDING', 'READY', 'FAILED')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'sections',
        constraint: 'sections_quick_status_check_58f1db0c',
        expression: "\"quick_status\" IN ('PENDING', 'READY', 'FAILED')",
      }),
      this.createIndex({
        schema: 'public',
        table: 'mnemonics',
        index: 'mnemonics_document_id_idx_d3d0944e',
        columns: ['document_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'mnemonics',
        index: 'mnemonics_document_id_position_idx_fad910b7',
        columns: ['document_id', 'position'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'mnemonics',
        index: 'mnemonics_section_id_idx_13db6de7',
        columns: ['section_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'mnemonics',
        foreignKey: {
          name: 'mnemonics_document_id_fkey',
          columns: ['document_id'],
          references: { schema: 'public', table: 'documents', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'mnemonics',
        foreignKey: {
          name: 'mnemonics_section_id_fkey',
          columns: ['section_id'],
          references: { schema: 'public', table: 'sections', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
