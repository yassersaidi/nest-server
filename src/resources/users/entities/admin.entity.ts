import { Entity, PrimaryGeneratedColumn, Column, OneToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Admin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, (user) => user.admin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
