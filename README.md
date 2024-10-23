# Nest Server

## Overview

This project is a web application built with Nest.js, TypeORM, PostgreSQL, and Docker.

## Getting Started

### Development Setup

1. **Update Database Host**:
   - Change `POSTGRES_HOST` in your `.env` file to `localhost`.

2. **Build and Start Services**:
   ```bash
   docker-compose up --build
   ```
3. **Run migrations**:
    ```bash
    npm run migrations:run
    ```
### Production Setup

1. **Update Database Host**:
   - Change `POSTGRES_HOST` in your `.env` file to `prod_db`.

2. **Build and Start Services**:
   ```bash
   docker-compose -f docker-compose.prod.yml up --build
   ```



### That's it