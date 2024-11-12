import { UserRoles } from "@/resources/common/enums/user-roles.enum"

export type AuthedUserReqType = {
    userId: string,
    role: UserRoles
    username: string,
    sessionId:string
}