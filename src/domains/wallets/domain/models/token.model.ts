import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import { TokenInterface } from "../interfaces/token.interafce";
import { Network } from "../interfaces/wallet.interface";

@Entity()
export class TokenModel implements TokenInterface {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  wallet_id: string;

  @Column()
  symbol: string;

  @Column({
    type: "enum",
    enum: Network,
    enumName: "Network",
  })
  network: Network;

  @Column()
  name: string;

  @Column({ nullable: true })
  contract: string;

  @Column({ type: "float", default: 0 })
  balance: number;

  @Column({ type: "float", default: 0 })
  balance_usd: number;

  @Column({ type: "float", nullable: true })
  price: number;

  @Column({ type: "float", nullable: true })
  price_change_percentage: number;

  @Column({ nullable: true })
  icon: string;

  @CreateDateColumn()
  added_at: string;

  @Column()
  updated_at: string;
}
