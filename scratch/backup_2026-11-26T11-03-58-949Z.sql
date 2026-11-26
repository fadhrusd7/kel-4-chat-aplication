-- MySQL dump 10.13  Distrib 8.4.3, for Win64 (x86_64)
--
-- Host: 10.86.24.229    Database: chat
-- ------------------------------------------------------
-- Server version	13.0.2-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sender_id` int(10) unsigned NOT NULL,
  `receiver_id` int(10) unsigned NOT NULL,
  `body` text NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT utc_timestamp(3),
  `deleted_at` timestamp(3) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_messages_pair` (`sender_id`,`receiver_id`,`id`),
  KEY `idx_messages_reverse` (`receiver_id`,`sender_id`,`id`),
  KEY `idx_messages_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_messages_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_messages_not_self` CHECK (`sender_id` <> `receiver_id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
INSERT INTO `messages` VALUES (1,1,2,'Halo Andi, ini pesan pertama dari Fadhil!','2026-11-24 11:07:47.872',NULL),(2,2,1,'Halo Fadhil! Pesanmu sudah saya terima.','2026-11-24 11:08:44.503',NULL),(3,3,1,'halo','2026-11-24 11:24:08.299',NULL),(4,3,1,'halo','2026-11-24 11:24:09.877',NULL),(5,4,1,'dhil','2026-11-26 09:15:04.951',NULL),(6,5,4,'hi','2026-11-26 10:22:07.353','2026-11-26 10:58:09.827'),(7,5,2,'hi','2026-11-26 10:22:57.585',NULL),(8,5,1,'oi','2026-11-26 10:23:02.978',NULL),(9,5,3,'p','2026-11-26 10:23:05.119',NULL),(10,4,5,'asdbadbsa','2026-11-26 10:35:28.374',NULL),(11,4,5,'auisdabdasdbjakd','2026-11-26 10:35:39.004',NULL);
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT utc_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_expiry` (`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES (5,3,'7a8e0c94bde51fa2e1cf7373801245ddff4da0a4dc2f7d06aad05744655e0804','2026-12-01 11:22:59.449','2026-11-24 11:22:59.449'),(6,4,'701380fbb87976d63cc537a6f4fe3599addf8f5e2ed2f3aa7b9a046f42ae2236','2026-12-03 09:14:19.172','2026-11-26 09:14:19.174'),(7,5,'9eebff57c831b5d094f5ac471548eceda15ab783f46100e69e1f404c26ff441d','2026-12-03 10:22:29.375','2026-11-26 10:22:00.356');
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT utc_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'fadhil','fadhil@example.com','$2b$12$19ZSwKPzm5H8NbYRaIIICe3dhOroejVPN/oz.gSGFi7l4mpy99.SK','2026-11-24 10:58:22.348'),(2,'andi','andi@example.com','$2b$12$UsnhIzP7xbe.DTGJ9FmLIO3sUW.FY6zOQl4w/wzyn7spxeQLNMSGW','2026-11-24 11:06:28.236'),(3,'rusadi','rusadi@example.cpm','$2b$12$MNQSdFYHWNjVzB7sLJ6xW.P2uCpf0kycLAvA4y7CVxJcmr2.G.quS','2026-11-24 11:21:52.616'),(4,'rusa','rusa@example.com','$2b$12$PmruM9Q/jUKqwkbL3mA0TenXAjsVctwoi1BERmXwjs0PbybFVY7jG','2026-11-26 09:14:05.513'),(5,'jejestud','jeje@example.com','$2b$12$qHGuhUTE8Ip9MshL5XWqfO5rRVP//eDGlX2S6XAyxN6pWn/3fJ9Lm','2026-11-26 10:21:45.188');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-26 18:03:59
