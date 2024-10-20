import { Column, CreateDateColumn, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Admin } from "./admin.entity";
import { Session } from "./session.entity";
import { VerificationCode } from "./verification.code.entity";

@Entity()
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({unique: true})
    email: string;

    @Column()
    password: string;

    @CreateDateColumn()
    createdAt: Date;
  
    @Column({ unique: true })
    username: string;
  
    @Column({ default: false })
    verified: boolean;
  
    @Column({ default: '/uploads/profile/default_profile_picture.png' })
    profilePicture: string;
  
    @OneToMany(() => Session, (session) => session.user, { eager: true })
    sessions: Session[];
  
    @OneToOne(() => VerificationCode, (code) => code.user, { eager: true })
    verificationCode: VerificationCode;
  
    @OneToOne(() => Admin, (admin) => admin.user, { eager: true } )
    admin?: Admin;
}
