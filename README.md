<div align="center">
  <img src="./docs/public/assets/logo.webp" alt="Escala Logo" width="400" />
</div>

# Escala Backend API
> Enterprise-grade SaaS for Multi-Tenant Academic Administration.

## Table of Contents
- [Escala Backend API](#escala-backend-api)
  - [Table of Contents](#table-of-contents)
  - [General Information](#general-information)
  - [Technologies Used](#technologies-used)
  - [Features](#features)
  - [Setup](#setup)
      - [Testing](#testing)
  - [Usage](#usage)
  - [Project Status](#project-status)
  - [Roadmap](#roadmap)
  - [Contact](#contact)

## General Information
Escala is a highly scalable, multi-tenant academic management system. It is the completely redesigned, enterprise-ready evolution of my previous MVP, **[AcademyCoreAPI](https://github.com/LZJorge/AcademyCoreAPI)**, which was originally built to manage university operations but paused to re-evaluate its architecture.

This reborn version leaves behind basic CRUD structures to embrace **Clean Architecture (Hexagonal / Vertical Slicing)**, strict Domain-Driven Design (DDD) principles, and advanced TypeScript configurations. The system is designed to handle the complex operations of modern educational institutions (Universities, Institutes, High Schools) in a B2B SaaS model, ensuring strict data isolation between tenants, granular Role-Based Access Control (RBAC), and mathematical validation for academic schedules and prerequisites.

The purpose of this project is to showcase advanced backend engineering capabilities, including architectural design, strict type safety, predictable error handling (Result Pattern), and robust database modeling.

## Technologies Used
![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgresql-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Jest](https://img.shields.io/badge/-jest-%23C21325?style=for-the-badge&logo=jest&logoColor=white)
![Swagger](https://img.shields.io/badge/-Swagger-%23Clojure?style=for-the-badge&logo=swagger&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-black?style=for-the-badge&logo=JSON%20web%20tokens)
![Husky](https://img.shields.io/badge/husky-%23404d59.svg?style=for-the-badge&logo=git&logoColor=white)

## Features
- **Strict Multi-Tenancy:** Complete data isolation between educational institutions. Users are uniquely tied to their institution's workspace.
- **Granular RBAC:** Dynamic permission matrix allowing custom hybrid roles (e.g., an Admin who is also a Teacher) with system-level override flags.
- **Academic Engine:** Robust handling of academic programs, terms, and complex prerequisite trees (validating both specific courses and global credit thresholds).
- **Mathematical Schedule Validation:** Schedule collision detection handled mathematically at the database/backend level during enrollment.
- **Immutable Transcripts:** Precise, decimal-based historical grading records isolated from active enrollments.
- **Clean Architecture:** Strict separation of Domain, Application, and Infrastructure layers using NestJS strictly as an infrastructure framework.

## Setup
To set up the local environment, this project uses **Bun** as the primary package manager and runtime.

```bash
# 1. Clone the repository
git clone [https://github.com/LZJorge/escala-backend.git](https://github.com/LZJorge/escala-backend.git)

# 2. Enter the project directory
cd escala-backend

# 3. Install dependencies
bun install

```

> **Environment Variables:** You must create a `.env` file from the `.env.example` template at the root of the project. Ensure you provide a valid PostgreSQL `DATABASE_URL`.

```bash
# 4. Generate the isolated Prisma Client and push the schema
bunx prisma generate
bunx prisma db push

# 5. Seed the database (Creates global Master and Student roles)
bun run seed

# 6. Start the API server in development mode
bun run start:dev

```

#### Testing

This project follows Test-Driven Development (TDD) practices.

```bash
# Run unit tests
bun run test

# Run e2e tests
bun run test:e2e

# Run test coverage
bun run test:cov

```

## Usage

The API endpoints are documented using Swagger. Once the server is running, navigate to the configured API documentation route (usually `/api/docs` or `/swagger`) to explore and test the available RESTful routes.

## Project Status

Project is: *In Progress*

## Roadmap

Upcoming features and infrastructural improvements:

* **Redis Integration:** Caching the RBAC permission matrix for extreme endpoint performance.
* **RabbitMQ Implementation:** Asynchronous processing for heavy tasks (e.g., closing an academic term and calculating thousands of final transcripts).
* **AWS S3 Integration:** Offloading static assets (Institution logos, student assignments) to cloud storage.
* **Grafana & Prometheus:** Adding system observability and metrics monitoring.
