import { TransactionInterface, TransactionStatus, TransactionType } from "../interfaces/transaction.interface";
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Network } from "../interfaces/wallet.interface";

@Entity()
export class TransactionModel implements TransactionInterface {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  wallet_id: string;

  @Column({
    type: "enum",
    enum: TransactionType,
    enumName: "TransactionType",
  })
  type: TransactionType;

  @Column({
    type: "enum",
    enum: Network,
    enumName: "Network",
  })
  network: Network;

  @Column()
  hash: string;

  @Column({
    type: "enum",
    enum: TransactionStatus,
    enumName: "TransactionStatus",
    nullable: true,
  })
  status: TransactionStatus;

  @Column({ type: "float", default: 0 })
  amount: number;

  @Column({ type: "float", default: 0 })
  amount_usd: number;

  @Column()
  to: string;

  @Column()
  from: string;

  @Column({ nullable: true })
  fromCurrency?: string;

  @Column({ nullable: true })
  toCurrency?: string;

  @Column({ type: "float", nullable: true })
  toAmount?: number;

  @Column({ type: "float", nullable: true })
  toAmount_usd?: number;

  @Column({nullable: true})
  currency?: string;

  @Column({ type: "float", default: 0 })
  fee: number;

  @Column({ type: "float", default: 0 })
  fee_usd: number;

  @UpdateDateColumn()
  updated_at: string;

  @CreateDateColumn()
  created_at: string;

  @Column({ type: "float", nullable: true })
  service_fee?: number;

  @Column({ type: "float", nullable: true })
  service_fee_usd?: number;

  @Column({ default: false })
  is_referral_processed?: boolean;
}
