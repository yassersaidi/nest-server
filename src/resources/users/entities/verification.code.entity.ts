import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, Index } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class VerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  code: string;

  @Column()
  expiresAt: Date;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.verificationCode)
  user: User;
}
