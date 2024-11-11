type AuthErrorResponse = {
  message: string[];
  url: string;
};

type AuthErrorCategories<T extends string = string> = {
  [K in T]: AuthErrorResponse;
};

type AuthErrorStructure = {
  register: AuthErrorCategories;
  login: AuthErrorCategories;
  verifyEmail: AuthErrorCategories;
  verifyEmailCode: AuthErrorCategories;
};

export const authResponseErrors: AuthErrorStructure = {
  register: {
    multipleErrors: {
      message: [
        "email must be an email",
        "email should not be empty",
        "password must be longer than or equal to 8 characters",
        "password must be a string",
        "password should not be empty",
        "username must be longer than or equal to 6 characters",
        "username must be a string",
        "username should not be empty",
        "phoneNumber must be longer than or equal to 10 characters",
        "phoneNumber must be a string",
        "phoneNumber should not be empty"
      ],
      url: "/api/v1/auth/register"
    },
    missingEmail: {
      message: [
        "email must be an email",
        "email should not be empty"
      ],
      url: "/api/v1/auth/register"
    },
    shortUsername: {
      message: [
        "username must be longer than or equal to 6 characters"
      ],
      url: "/api/v1/auth/register"
    },
    shortPassword: {
      message: [
        "password must be longer than or equal to 8 characters"
      ],
      url: "/api/v1/auth/register"
    },
    invalidPhoneNumber: {
      message: [
        "phoneNumber must be longer than or equal to 10 characters"
      ],
      url: "/api/v1/auth/register"
    }
  },
  login: {
    multipleErrors: {
      message: [
        "email must be an email",
        "email should not be empty",
        "password must be longer than or equal to 8 characters",
        "password must be a string",
        "password should not be empty"
      ],
      url: "/api/v1/auth/login"
    },
    emailNotAnEmail: {
      message: [
        "email must be an email"
      ],
      url: "/api/v1/auth/login"
    },
    passwordNotFound: {
      message: [
        "password must be longer than or equal to 8 characters",
        "password must be a string",
        "password should not be empty"
      ],
      url: "/api/v1/auth/login"
    }
  },
  verifyEmail: {
    invalidEmail: {
      message: [
        "email must be an email",
        "email should not be empty"
      ],
      url: "/api/v1/auth/verify-email"
    }
  },
  verifyEmailCode: {
    multipleErrors: {
      message: [
        "email must be an email",
        "code must be longer than or equal to 6 characters",
        "code must be a string"
      ],
      url: "/api/v1/auth/verify-email-code"
    }
  }
} as const;
