import { Network, WalletInterface, WalletType } from "../interfaces/wallet.interface";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { TokenModel } from "./token.model";

@Entity()
export class WalletModel implements WalletInterface {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  user_id: string;

  @Column({
    type: "enum",
    enum: WalletType,
    enumName: "WalletType",
  })
  type: WalletType;

  @Column({
    type: "enum",
    enum: Network,
    enumName: "Network",
  })
  network: Network;

  @Column({ nullable: true })
  name: string;

  @Column()
  address: string;

  @Column()
  is_generated: boolean;

  @Column()
  is_imported: boolean;

  @Column({ type: "float", default: 0 })
  balance: number;

  @Column({ type: "float", default: 0 })
  balance_usd: number;

  @Column()
  updated_at: string;

  @Column()
  created_at: string;

  @Column({ default: true })
  can_deleted: boolean;

  private_key?: string;

  tokens?: TokenModel[];
}
