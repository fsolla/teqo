-- Runs once, on first initialization of the Postgres data volume.
-- Creates the dedicated database used by the automated test suite so that
-- tests (which delete and recreate records) never share state with local
-- development data — and can never be pointed at production.
CREATE DATABASE teqo_test;
