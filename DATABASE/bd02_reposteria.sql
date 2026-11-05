-- ============================================================
-- BD02 - Tienda en línea de REPOSTERÍA
-- Motor: MySQL 8.x (InnoDB, utf8mb4)
-- Módulos: Control de acceso, Inventario, Compras, Ventas-Carrito
-- ============================================================

CREATE DATABASE IF NOT EXISTS bd02
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bd02;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- CONTROL DE ACCESO
-- ============================================================

CREATE TABLE `ROLES` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `nombre_rol`  VARCHAR(50)  NOT NULL,
  `descripcion` VARCHAR(150) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_nombre` (`nombre_rol`)
) ENGINE=InnoDB;

CREATE TABLE `USUARIOS` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `nombre`            VARCHAR(100) NOT NULL,
  `correo`            VARCHAR(150) NOT NULL,
  `telefono`          VARCHAR(20)  NULL,
  `password_hash`     VARCHAR(255) NOT NULL,
  `id_rol`            INT NOT NULL,
  `estado`            VARCHAR(20)  NOT NULL DEFAULT 'activo',
  `intentos_fallidos` INT NOT NULL DEFAULT 0,
  `bloqueado_hasta`   DATETIME(3) NULL,
  `fecha_registro`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_correo` (`correo`),
  KEY `ix_usuarios_rol` (`id_rol`),
  CONSTRAINT `fk_usuarios_rol` FOREIGN KEY (`id_rol`) REFERENCES `ROLES` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `TOKENS_RECUPERACION` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `id_usuario`       INT NOT NULL,
  `token`            VARCHAR(255) NOT NULL,
  `fecha_creacion`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `fecha_expiracion` DATETIME(3) NOT NULL,
  `usado`            TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tokens_token` (`token`),
  KEY `ix_tokens_usuario` (`id_usuario`),
  CONSTRAINT `fk_tokens_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `USUARIOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `CLIENTES` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `id_usuario` INT NOT NULL,
  `rfc`        VARCHAR(13) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_clientes_usuario` (`id_usuario`),
  CONSTRAINT `fk_clientes_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `USUARIOS` (`id`)
) ENGINE=InnoDB;

-- ============================================================
-- INVENTARIO (producto terminado + insumos)
-- ============================================================

CREATE TABLE `CATEGORIAS` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `nombre`      VARCHAR(80)  NOT NULL,
  `descripcion` VARCHAR(150) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categorias_nombre` (`nombre`)
) ENGINE=InnoDB;

CREATE TABLE `PRODUCTOS` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `id_categoria`      INT NOT NULL,
  `nombre`            VARCHAR(120) NOT NULL,
  `descripcion`       TEXT NULL,
  `sabor`             VARCHAR(60)  NULL,
  `porciones`         INT NULL,
  `lote`              VARCHAR(50)  NULL,
  `caducidad`         DATE NULL,
  `costo`             DECIMAL(10,2) NOT NULL,
  `precio`            DECIMAL(10,2) NOT NULL,
  `es_personalizable` TINYINT(1) NOT NULL DEFAULT 0,
  `activo`            TINYINT(1) NOT NULL DEFAULT 1,
  `imagen_url`        VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_productos_categoria` (`id_categoria`),
  CONSTRAINT `fk_productos_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `CATEGORIAS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `STOCK` (
  `id_producto`  INT NOT NULL,
  `stock_actual` INT NOT NULL DEFAULT 0,
  `stock_minimo` INT NOT NULL DEFAULT 0,
  `stock_maximo` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id_producto`),
  CONSTRAINT `fk_stock_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `PROMOCIONES` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `id_producto`          INT NOT NULL,
  `porcentaje_descuento` DECIMAL(5,2) NOT NULL,
  `motivo`               VARCHAR(100) NULL,
  `fecha_inicio`         DATE NOT NULL,
  `fecha_fin`            DATE NOT NULL,
  `activa`               TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `ix_promociones_producto` (`id_producto`),
  CONSTRAINT `fk_promociones_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `RESENAS` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `id_producto`  INT NOT NULL,
  `id_cliente`   INT NOT NULL,
  `calificacion` INT NOT NULL,
  `comentario`   TEXT NULL,
  `fecha`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_resenas_producto` (`id_producto`),
  KEY `ix_resenas_cliente` (`id_cliente`),
  CONSTRAINT `ck_resenas_calificacion` CHECK (`calificacion` BETWEEN 1 AND 5),
  CONSTRAINT `fk_resenas_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`),
  CONSTRAINT `fk_resenas_cliente`  FOREIGN KEY (`id_cliente`)  REFERENCES `CLIENTES` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `PROVEEDORES` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `nombre`       VARCHAR(120) NOT NULL,
  `razon_social` VARCHAR(150) NULL,
  `rfc`          VARCHAR(13)  NULL,
  `direccion`    VARCHAR(200) NULL,
  `correo`       VARCHAR(150) NULL,
  `telefono`     VARCHAR(20)  NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `INSUMOS` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `nombre`         VARCHAR(120) NOT NULL,
  `descripcion`    VARCHAR(200) NULL,
  `unidad_medida`  VARCHAR(20)  NOT NULL,
  `stock_actual`   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `stock_minimo`   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `stock_maximo`   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `costo_unitario` DECIMAL(10,2) NOT NULL,
  `caducidad`      DATE NULL,
  `id_proveedor`   INT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_insumos_proveedor` (`id_proveedor`),
  CONSTRAINT `fk_insumos_proveedor` FOREIGN KEY (`id_proveedor`) REFERENCES `PROVEEDORES` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `RECETAS` (
  `id_producto` INT NOT NULL,
  `id_insumo`   INT NOT NULL,
  `cantidad`    DECIMAL(10,3) NOT NULL,
  PRIMARY KEY (`id_producto`, `id_insumo`),
  KEY `ix_recetas_insumo` (`id_insumo`),
  CONSTRAINT `fk_recetas_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`),
  CONSTRAINT `fk_recetas_insumo`   FOREIGN KEY (`id_insumo`)   REFERENCES `INSUMOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ALERTAS_INVENTARIO` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `tipo`        VARCHAR(10) NOT NULL,
  `id_producto` INT NULL,
  `id_insumo`   INT NULL,
  `mensaje`     VARCHAR(200) NULL,
  `fecha`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atendida`    TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `ix_alertas_producto` (`id_producto`),
  KEY `ix_alertas_insumo` (`id_insumo`),
  CONSTRAINT `ck_alertas_tipo` CHECK (`tipo` IN ('MINIMO','MAXIMO')),
  CONSTRAINT `fk_alertas_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`),
  CONSTRAINT `fk_alertas_insumo`   FOREIGN KEY (`id_insumo`)   REFERENCES `INSUMOS` (`id`)
) ENGINE=InnoDB;

-- ============================================================
-- COMPRAS (de insumos a proveedores)
-- ============================================================

CREATE TABLE `COMPRAS` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `id_proveedor` INT NOT NULL,
  `id_usuario`   INT NOT NULL,
  `fecha`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `total`        DECIMAL(12,2) NOT NULL DEFAULT 0,
  `estado`       VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (`id`),
  KEY `ix_compras_proveedor` (`id_proveedor`),
  KEY `ix_compras_usuario` (`id_usuario`),
  CONSTRAINT `fk_compras_proveedor` FOREIGN KEY (`id_proveedor`) REFERENCES `PROVEEDORES` (`id`),
  CONSTRAINT `fk_compras_usuario`   FOREIGN KEY (`id_usuario`)   REFERENCES `USUARIOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `DETALLE_COMPRAS` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `id_compra`      INT NOT NULL,
  `id_insumo`      INT NOT NULL,
  `cantidad`       DECIMAL(10,2) NOT NULL,
  `costo_unitario` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_detcompras_compra` (`id_compra`),
  KEY `ix_detcompras_insumo` (`id_insumo`),
  CONSTRAINT `fk_detcompras_compra` FOREIGN KEY (`id_compra`) REFERENCES `COMPRAS` (`id`),
  CONSTRAINT `fk_detcompras_insumo` FOREIGN KEY (`id_insumo`) REFERENCES `INSUMOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `DEVOLUCIONES_COMPRA` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `id_compra` INT NOT NULL,
  `id_insumo` INT NOT NULL,
  `cantidad`  DECIMAL(10,2) NOT NULL,
  `motivo`    VARCHAR(255) NULL,
  `fecha`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_devcompra_compra` (`id_compra`),
  KEY `ix_devcompra_insumo` (`id_insumo`),
  CONSTRAINT `fk_devcompra_compra` FOREIGN KEY (`id_compra`) REFERENCES `COMPRAS` (`id`),
  CONSTRAINT `fk_devcompra_insumo` FOREIGN KEY (`id_insumo`) REFERENCES `INSUMOS` (`id`)
) ENGINE=InnoDB;

-- ============================================================
-- VENTAS - CARRITO
-- ============================================================

CREATE TABLE `CARRITO` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `id_cliente`     INT NOT NULL,
  `fecha_creacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `estado`         VARCHAR(20) NOT NULL DEFAULT 'abierto',
  PRIMARY KEY (`id`),
  KEY `ix_carrito_cliente` (`id_cliente`),
  CONSTRAINT `fk_carrito_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `CLIENTES` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `DETALLE_CARRITO` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `id_carrito`  INT NOT NULL,
  `id_producto` INT NOT NULL,
  `cantidad`    INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_detcarrito_carrito` (`id_carrito`),
  KEY `ix_detcarrito_producto` (`id_producto`),
  CONSTRAINT `fk_detcarrito_carrito`  FOREIGN KEY (`id_carrito`)  REFERENCES `CARRITO` (`id`),
  CONSTRAINT `fk_detcarrito_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `TIPOS_PAGO` (
  `id`     INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tipospago_nombre` (`nombre`)
) ENGINE=InnoDB;

-- Nunca se guarda el número completo ni el CVV: solo token del procesador,
-- últimos 4 dígitos, marca y vencimiento.
CREATE TABLE `TARJETAS` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `id_cliente`      INT NOT NULL,
  `token_pago`      VARCHAR(255) NOT NULL,
  `ultimos_digitos` CHAR(4) NOT NULL,
  `marca`           VARCHAR(20) NOT NULL,
  `mes_expiracion`  TINYINT NOT NULL,
  `anio_expiracion` SMALLINT NOT NULL,
  `verificada`      TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tarjetas_token` (`token_pago`),
  KEY `ix_tarjetas_cliente` (`id_cliente`),
  CONSTRAINT `fk_tarjetas_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `CLIENTES` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `DIRECCIONES` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `id_cliente`    INT NOT NULL,
  `calle_numero`  VARCHAR(150) NOT NULL,
  `colonia`       VARCHAR(100) NULL,
  `ciudad`        VARCHAR(100) NULL,
  `codigo_postal` VARCHAR(10)  NULL,
  `referencias`   VARCHAR(200) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_direcciones_cliente` (`id_cliente`),
  CONSTRAINT `fk_direcciones_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `CLIENTES` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `PEDIDOS` (
  `id`                         INT NOT NULL AUTO_INCREMENT,
  `id_carrito`                 INT NOT NULL,
  `id_cliente`                 INT NOT NULL,
  `id_direccion`               INT NULL,
  `id_tipo_pago`               INT NOT NULL,
  `id_tarjeta`                 INT NULL,
  `tipo_entrega`               VARCHAR(20) NOT NULL DEFAULT 'DOMICILIO',
  `fecha_pedido`               DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `fecha_entrega_programada`   DATETIME(3) NULL,
  `anticipo`                   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `costo_envio`                DECIMAL(10,2) NOT NULL DEFAULT 0,
  `total`                      DECIMAL(12,2) NOT NULL DEFAULT 0,
  `estado`                     VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pedidos_carrito` (`id_carrito`),
  KEY `ix_pedidos_cliente` (`id_cliente`),
  KEY `ix_pedidos_direccion` (`id_direccion`),
  KEY `ix_pedidos_tipopago` (`id_tipo_pago`),
  KEY `ix_pedidos_tarjeta` (`id_tarjeta`),
  CONSTRAINT `ck_pedidos_entrega` CHECK (`tipo_entrega` IN ('DOMICILIO','RECOGER')),
  CONSTRAINT `fk_pedidos_carrito`   FOREIGN KEY (`id_carrito`)   REFERENCES `CARRITO` (`id`),
  CONSTRAINT `fk_pedidos_cliente`   FOREIGN KEY (`id_cliente`)   REFERENCES `CLIENTES` (`id`),
  CONSTRAINT `fk_pedidos_direccion` FOREIGN KEY (`id_direccion`) REFERENCES `DIRECCIONES` (`id`),
  CONSTRAINT `fk_pedidos_tipopago`  FOREIGN KEY (`id_tipo_pago`) REFERENCES `TIPOS_PAGO` (`id`),
  CONSTRAINT `fk_pedidos_tarjeta`   FOREIGN KEY (`id_tarjeta`)   REFERENCES `TARJETAS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `VENTAS` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `id_pedido`  INT NOT NULL,
  `id_cliente` INT NOT NULL,
  `fecha`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `total`      DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ventas_pedido` (`id_pedido`),
  KEY `ix_ventas_cliente` (`id_cliente`),
  CONSTRAINT `fk_ventas_pedido`  FOREIGN KEY (`id_pedido`)  REFERENCES `PEDIDOS` (`id`),
  CONSTRAINT `fk_ventas_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `CLIENTES` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `DETALLE_VENTAS` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `id_venta`        INT NOT NULL,
  `id_producto`     INT NOT NULL,
  `cantidad`        INT NOT NULL,
  `precio_unitario` DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ix_detventas_venta` (`id_venta`),
  KEY `ix_detventas_producto` (`id_producto`),
  CONSTRAINT `fk_detventas_venta`    FOREIGN KEY (`id_venta`)    REFERENCES `VENTAS` (`id`),
  CONSTRAINT `fk_detventas_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `PERSONALIZACIONES` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `id_detalle_carrito`    INT NULL,
  `id_detalle_venta`      INT NULL,
  `mensaje_pastel`        VARCHAR(100) NULL,
  `relleno`               VARCHAR(80)  NULL,
  `cobertura`             VARCHAR(80)  NULL,
  `decoracion`            TEXT NULL,
  `imagen_referencia_url` VARCHAR(255) NULL,
  `notas_alergias`        VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_personal_detcarrito` (`id_detalle_carrito`),
  UNIQUE KEY `uq_personal_detventa` (`id_detalle_venta`),
  CONSTRAINT `fk_personal_detcarrito` FOREIGN KEY (`id_detalle_carrito`) REFERENCES `DETALLE_CARRITO` (`id`),
  CONSTRAINT `fk_personal_detventa`   FOREIGN KEY (`id_detalle_venta`)   REFERENCES `DETALLE_VENTAS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `COMPROBANTES` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `id_venta`       INT NOT NULL,
  `folio`          VARCHAR(30) NOT NULL,
  `fecha_emision`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `enviado_correo` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_comprobantes_venta` (`id_venta`),
  UNIQUE KEY `uq_comprobantes_folio` (`folio`),
  CONSTRAINT `fk_comprobantes_venta` FOREIGN KEY (`id_venta`) REFERENCES `VENTAS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ENVIOS` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `id_venta`               INT NOT NULL,
  `id_direccion`           INT NOT NULL,
  `num_guia`               VARCHAR(30) NOT NULL,
  `repartidor`             VARCHAR(100) NULL,
  `estado`                 VARCHAR(20) NOT NULL DEFAULT 'preparando',
  `fecha_envio`            DATETIME(3) NULL,
  `fecha_estimada_entrega` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_envios_venta` (`id_venta`),
  UNIQUE KEY `uq_envios_guia` (`num_guia`),
  KEY `ix_envios_direccion` (`id_direccion`),
  CONSTRAINT `fk_envios_venta`     FOREIGN KEY (`id_venta`)     REFERENCES `VENTAS` (`id`),
  CONSTRAINT `fk_envios_direccion` FOREIGN KEY (`id_direccion`) REFERENCES `DIRECCIONES` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `VALIDACION_ENTREGA` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `id_envio`           INT NOT NULL,
  `fecha_entrega_real` DATETIME(3) NULL,
  `evidencia`          VARCHAR(255) NULL,
  `estado`             VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_validacion_envio` (`id_envio`),
  CONSTRAINT `fk_validacion_envio` FOREIGN KEY (`id_envio`) REFERENCES `ENVIOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `DEVOLUCIONES_VENTA` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `id_venta`    INT NOT NULL,
  `id_producto` INT NOT NULL,
  `cantidad`    INT NOT NULL,
  `motivo`      VARCHAR(255) NULL,
  `fecha`       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `estado`      VARCHAR(20) NOT NULL DEFAULT 'solicitada',
  PRIMARY KEY (`id`),
  KEY `ix_devventa_venta` (`id_venta`),
  KEY `ix_devventa_producto` (`id_producto`),
  CONSTRAINT `fk_devventa_venta`    FOREIGN KEY (`id_venta`)    REFERENCES `VENTAS` (`id`),
  CONSTRAINT `fk_devventa_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `GARANTIAS` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `id_venta`        INT NOT NULL,
  `id_producto`     INT NOT NULL,
  `fecha_solicitud` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `motivo`          VARCHAR(255) NULL,
  `estado`          VARCHAR(20) NOT NULL DEFAULT 'abierta',
  `resolucion`      VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_garantias_venta` (`id_venta`),
  KEY `ix_garantias_producto` (`id_producto`),
  CONSTRAINT `fk_garantias_venta`    FOREIGN KEY (`id_venta`)    REFERENCES `VENTAS` (`id`),
  CONSTRAINT `fk_garantias_producto` FOREIGN KEY (`id_producto`) REFERENCES `PRODUCTOS` (`id`)
) ENGINE=InnoDB;

-- ============================================================
-- PAGOS, FONDO, EMPAQUETADO, CONTACTO Y BITÁCORA (servicios del equipo)
-- ============================================================

CREATE TABLE `PAGOS` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `id_pedido`          INT NOT NULL,
  `id_tipo_pago`       INT NOT NULL,
  `monto`              DECIMAL(12,2) NOT NULL,
  `estado`             VARCHAR(20) NOT NULL,
  `codigo_autorizacion` VARCHAR(30) NULL,
  `fecha`              DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_pagos_pedido` (`id_pedido`),
  CONSTRAINT `fk_pagos_pedido`   FOREIGN KEY (`id_pedido`)    REFERENCES `PEDIDOS` (`id`),
  CONSTRAINT `fk_pagos_tipopago` FOREIGN KEY (`id_tipo_pago`) REFERENCES `TIPOS_PAGO` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `CONFIG_FONDO` (
  `id`     INT NOT NULL AUTO_INCREMENT,
  `clave`  VARCHAR(40) NOT NULL,
  `valor`  VARCHAR(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fondo_clave` (`clave`)
) ENGINE=InnoDB;

CREATE TABLE `EMPAQUETADOS` (
  `id`        INT NOT NULL AUTO_INCREMENT,
  `id_venta`  INT NOT NULL,
  `tipo_caja` VARCHAR(40) NOT NULL,
  `notas`     VARCHAR(200) NULL,
  `estado`    VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  `fecha`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_empaque_venta` (`id_venta`),
  CONSTRAINT `fk_empaque_venta` FOREIGN KEY (`id_venta`) REFERENCES `VENTAS` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `MENSAJES_CONTACTO` (
  `id`      INT NOT NULL AUTO_INCREMENT,
  `nombre`  VARCHAR(100) NOT NULL,
  `correo`  VARCHAR(150) NOT NULL,
  `asunto`  VARCHAR(120) NOT NULL,
  `mensaje` TEXT NOT NULL,
  `leido`   TINYINT(1) NOT NULL DEFAULT 0,
  `fecha`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- La IP se guarda solo como hash (privacidad).
CREATE TABLE `BITACORA_SEGURIDAD` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `evento`     VARCHAR(40) NOT NULL,
  `id_usuario` INT NULL,
  `ip_hash`    CHAR(16) NULL,
  `detalle`    VARCHAR(200) NULL,
  `fecha`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ix_bitacora_evento` (`evento`)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- DATOS INICIALES
-- (los usuarios de prueba se crean con: npm run prisma:seed)
-- ============================================================

INSERT INTO `ROLES` (`id`, `nombre_rol`, `descripcion`) VALUES
  (1, 'ADMIN',     'Administrador del sistema'),
  (2, 'CLIENTE',   'Cliente de la tienda'),
  (3, 'REPOSTERO', 'Personal de producción: inventario e insumos');

INSERT INTO `TIPOS_PAGO` (`nombre`) VALUES
  ('Tarjeta de crédito/débito'), ('Transferencia'), ('Efectivo contra entrega'), ('Pago en tienda');

INSERT INTO `CATEGORIAS` (`nombre`, `descripcion`) VALUES
  ('Cumpleaños', 'Pasteles y chocoflanes para festejar'),
  ('Baby shower', 'Revelación de género y primeros meses'),
  ('Mamá y papá', 'Día de las Madres y Día del Padre'),
  ('San Valentín', 'Cajas de cupcakes con corazones'),
  ('Antojos', 'Charolas individuales de postre');

INSERT INTO `CONFIG_FONDO` (`clave`, `valor`) VALUES
  ('color_primario', '#c4122f'), ('color_fondo', '#fff7f4'), ('tienda_eslogan', 'Hecho con amor, entregado con cuidado');
