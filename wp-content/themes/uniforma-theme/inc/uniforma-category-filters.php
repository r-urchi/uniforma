<?php
/**
 * Helpers compartidos para filtros y muestras visuales del catálogo UNIFORMA.
 */

if (! defined('ABSPATH')) {
    exit;
}

if (! function_exists('uniforma_category_request_values')) {
    /**
     * Lee un filtro GET que puede llegar como valor único o como arreglo.
     */
    function uniforma_category_request_values($key)
    {
        if (! isset($_GET[$key])) {
            return array();
        }

        $raw_values = wp_unslash($_GET[$key]);
        $raw_values = is_array($raw_values) ? $raw_values : array($raw_values);
        $values = array();

        foreach ($raw_values as $raw_value) {
            if (! is_scalar($raw_value)) {
                continue;
            }

            $value = sanitize_title((string) $raw_value);

            if ($value !== '') {
                $values[$value] = $value;
            }
        }

        return array_values($values);
    }
}

if (! function_exists('uniforma_category_get_product_attribute_terms')) {
    /**
     * Devuelve los términos de un atributo respetando el orden guardado en el producto.
     */
    function uniforma_category_get_product_attribute_terms($product, $taxonomy)
    {
        if (! $product instanceof WC_Product || ! taxonomy_exists($taxonomy)) {
            return array();
        }

        $ordered = array();
        $seen = array();
        $attributes = $product->get_attributes();
        $attribute = isset($attributes[$taxonomy]) ? $attributes[$taxonomy] : null;

        if ($attribute instanceof WC_Product_Attribute && $attribute->is_taxonomy()) {
            foreach ($attribute->get_options() as $term_id) {
                $term = get_term((int) $term_id, $taxonomy);

                if (! $term || is_wp_error($term) || isset($seen[$term->slug])) {
                    continue;
                }

                $seen[$term->slug] = true;
                $ordered[] = $term;
            }
        }

        if (empty($ordered)) {
            $fallback = wc_get_product_terms($product->get_id(), $taxonomy, array('fields' => 'all'));

            if (! is_wp_error($fallback)) {
                foreach ((array) $fallback as $term) {
                    if (! $term || isset($seen[$term->slug])) {
                        continue;
                    }

                    $seen[$term->slug] = true;
                    $ordered[] = $term;
                }
            }
        }

        return $ordered;
    }
}

if (! function_exists('uniforma_category_get_terms_for_products')) {
    /**
     * Reúne todos los términos realmente utilizados por un conjunto de productos.
     */
    function uniforma_category_get_terms_for_products($taxonomy, $product_ids)
    {
        if (empty($product_ids) || ! taxonomy_exists($taxonomy)) {
            return array();
        }

        $terms_by_id = array();
        $bulk_terms = wp_get_object_terms(array_map('intval', $product_ids), $taxonomy, array(
            'orderby' => 'name',
            'order' => 'ASC',
        ));

        if (! is_wp_error($bulk_terms)) {
            foreach ((array) $bulk_terms as $term) {
                if ($term instanceof WP_Term) {
                    $terms_by_id[(int) $term->term_id] = $term;
                }
            }
        }

        // Respaldo para importaciones donde las opciones quedaron guardadas en el atributo
        // del producto, pero el conteo de la taxonomía todavía no se recalculó.
        foreach (array_map('intval', $product_ids) as $product_id) {
            $product = wc_get_product($product_id);

            if (! $product) {
                continue;
            }

            foreach (uniforma_category_get_product_attribute_terms($product, $taxonomy) as $term) {
                $terms_by_id[(int) $term->term_id] = $term;
            }
        }

        $terms = array_values($terms_by_id);

        usort($terms, static function ($left, $right) {
            return strnatcasecmp(remove_accents($left->name), remove_accents($right->name));
        });

        return $terms;
    }
}

if (! function_exists('uniforma_category_size_sort_key')) {
    function uniforma_category_size_sort_key($label)
    {
        $normalized = strtoupper(trim(remove_accents(wp_strip_all_tags((string) $label))));
        $normalized = preg_replace('/\s+/', '', $normalized);
        $normalized = str_replace(array('–', '—'), '-', $normalized);

        $alpha_order = array(
            'XXS' => 10,
            'XS' => 20,
            'S' => 30,
            'M' => 40,
            'L' => 50,
            'XL' => 60,
            'XXL' => 70,
            'XXXL' => 80,
            '3XL' => 80,
            '4XL' => 90,
            '5XL' => 100,
            '6XL' => 110,
            '7XL' => 120,
            '8XL' => 130,
        );

        if (isset($alpha_order[$normalized])) {
            return array(10, $alpha_order[$normalized], $normalized);
        }

        if (preg_match('/^(\d+)XL$/', $normalized, $matches)) {
            return array(10, 70 + ((int) $matches[1] * 10), $normalized);
        }

        if (ctype_digit($normalized)) {
            return array(20, (int) $normalized, $normalized);
        }

        if (preg_match('/^(\d+)(?:AL|-)(\d+)$/', $normalized, $matches)) {
            return array(20, (int) $matches[1], $normalized);
        }

        if (preg_match('/^(\d+)E$/', $normalized, $matches)) {
            return array(30, (int) $matches[1], $normalized);
        }

        if (in_array($normalized, array('TALLEUNICO', 'UNICO', 'UNICA'), true)) {
            return array(90, 0, $normalized);
        }

        return array(80, 0, $normalized);
    }
}

if (! function_exists('uniforma_category_sort_size_terms')) {
    function uniforma_category_sort_size_terms($terms)
    {
        $indexed = array();

        foreach ((array) $terms as $index => $term) {
            if (! $term instanceof WP_Term) {
                continue;
            }

            $indexed[] = array(
                'term' => $term,
                'key' => uniforma_category_size_sort_key($term->name),
                'index' => $index,
            );
        }

        usort($indexed, static function ($left, $right) {
            for ($i = 0; $i < 3; $i++) {
                if ($left['key'][$i] === $right['key'][$i]) {
                    continue;
                }

                if (is_numeric($left['key'][$i]) && is_numeric($right['key'][$i])) {
                    return $left['key'][$i] <=> $right['key'][$i];
                }

                return strnatcasecmp((string) $left['key'][$i], (string) $right['key'][$i]);
            }

            return $left['index'] <=> $right['index'];
        });

        return array_map(static function ($entry) {
            return $entry['term'];
        }, $indexed);
    }
}

if (! function_exists('uniforma_category_color_swatch')) {
    /**
     * Paleta completa del catálogo. El fallback genera un tono estable para que
     * cualquier color nuevo siempre sea visible.
     */
    function uniforma_category_color_swatch($color_name)
    {
        $override = uniforma_term_hex_override($color_name);

        if ('' !== $override) {
            return uniforma_swatch_from_hex($override);
        }

        $slug = sanitize_title(remove_accents((string) $color_name));
        $aliases = array(
            'azul-y-blanco' => 'azul-blanco',
            'blanca-negra' => 'blanco-negro',
            'blnco-verde-benetton' => 'blanco-verde-benetton',
            'blnco-rosa' => 'blanco-rosa',
            'gris-y-negro' => 'gris-negro',
            'celaste-localizado' => 'celeste-localizado',
        );

        if (isset($aliases[$slug])) {
            $slug = $aliases[$slug];
        }

        $palette = array(
            'aero' => '#66c4d2',
            'amarillo' => '#f2c94c',
            'arena' => '#c6a878',
            'azul' => '#193552',
            'azul-francia' => '#2458a6',
            'azul-liso' => '#173a63',
            'azul-localizado' => 'linear-gradient(135deg, #173a63 0 48%, #5d7ea1 52% 100%)',
            'azul-blanco' => 'linear-gradient(135deg, #1c3b65 0 50%, #ffffff 50% 100%)',
            'azul-marino' => '#172a46',
            'beige' => '#ded1bd',
            'blanco' => '#ffffff',
            'blanco-azul-marino' => 'linear-gradient(135deg, #ffffff 0 50%, #172a46 50% 100%)',
            'blanco-celeste' => 'linear-gradient(135deg, #ffffff 0 50%, #98cfe9 50% 100%)',
            'blanco-negro' => 'linear-gradient(135deg, #ffffff 0 50%, #171717 50% 100%)',
            'blanco-rosa' => 'linear-gradient(135deg, #ffffff 0 50%, #e8a6b7 50% 100%)',
            'blanco-verde-benetton' => 'linear-gradient(135deg, #ffffff 0 50%, #148552 50% 100%)',
            'bordo' => '#7a1f3d',
            'celeste' => '#9bcee7',
            'celeste-liso' => '#8fc8e6',
            'celeste-localizado' => 'linear-gradient(135deg, #8fc8e6 0 48%, #d3e8f3 52% 100%)',
            'celeste-melangino' => 'repeating-linear-gradient(135deg, #b4ccd5 0 4px, #9fb9c3 4px 8px)',
            'chocolate' => '#4a2d22',
            'gris' => '#97999c',
            'gris-plomo' => '#50545b',
            'gris-negro' => 'linear-gradient(135deg, #85888c 0 50%, #171717 50% 100%)',
            'lila' => '#bca4d6',
            'marron' => '#6a4637',
            'melange' => 'repeating-linear-gradient(135deg, #d0d1d2 0 4px, #b8babd 4px 8px)',
            'melange-azul-marino' => 'linear-gradient(135deg, #c2c4c6 0 50%, #172a46 50% 100%)',
            'melange-bordo' => 'linear-gradient(135deg, #c2c4c6 0 50%, #7a1f3d 50% 100%)',
            'melange-negro' => 'linear-gradient(135deg, #c2c4c6 0 50%, #171717 50% 100%)',
            'mostaza' => '#c7962d',
            'natural' => '#eee6d8',
            'naranja' => '#df7b2f',
            'negro' => '#171717',
            'negro-liso' => '#111111',
            'negro-localizado-gris-oscuro' => 'linear-gradient(135deg, #151515 0 48%, #3f4348 52% 100%)',
            'negro-localizado-gris' => 'linear-gradient(135deg, #171717 0 48%, #777b80 52% 100%)',
            'negro-oxido' => '#4b2a22',
            'rojo' => '#c72c31',
            'rosa' => '#e7a4b4',
            'verde' => '#354f3b',
            'verde-acqua' => '#6eb9a9',
            'verde-benetton' => '#148552',
            'verde-botella' => '#214a36',
            'verde-militar' => '#4c5130',
            'verde-oliva' => '#68724a',
            'violeta' => '#6e3d8b',
        );

        $light_slugs = array(
            'amarillo', 'arena', 'beige', 'blanco', 'blanco-azul-marino',
            'blanco-celeste', 'blanco-negro', 'blanco-rosa', 'blanco-verde-benetton',
            'celeste', 'celeste-liso', 'celeste-localizado', 'celeste-melangino',
            'lila', 'melange', 'melange-azul-marino', 'melange-bordo', 'melange-negro',
            'natural', 'rosa', 'verde-acqua',
        );

        if (isset($palette[$slug])) {
            $background = $palette[$slug];
        } else {
            $hash = abs((int) crc32($slug ?: (string) $color_name));
            $background = sprintf('hsl(%d 46%% 42%%)', $hash % 360);
        }

        return array(
            'slug' => $slug,
            'background' => $background,
            'light' => in_array($slug, $light_slugs, true),
        );
    }
}

if (! function_exists('uniforma_category_rubro_definitions')) {
    /**
     * Agrupa las categorías actuales y sus nombres históricos bajo los rubros
     * comerciales que se muestran en el sitio.
     */
    function uniforma_category_rubro_definitions()
    {
        return array(
            'gastronomia' => array(
                'label' => 'Gastronomía y hotelería',
                'slugs' => array('gastronomia', 'gastronomia-hoteleria', 'gastronomia-y-hoteleria'),
            ),
            'industria-construccion' => array(
                'label' => 'Industria y construcción',
                'slugs' => array('industria-construccion', 'industria-y-construccion', 'ropa-de-trabajo'),
            ),
            'comercio-atencion' => array(
                'label' => 'Comercio y atención',
                'slugs' => array('comercio-atencion', 'comercio-y-atencion'),
            ),
            'salud-estetica' => array(
                'label' => 'Salud y estética',
                'slugs' => array('salud-estetica', 'salud-y-estetica', 'salud'),
            ),
            'empresas-oficinas' => array(
                'label' => 'Empresas y oficinas',
                'slugs' => array('empresas-oficinas', 'empresas-y-oficinas', 'administrativo'),
            ),
            'campo-tradicion' => array(
                'label' => 'Campo y tradición',
                'slugs' => array('campo-tradicion', 'campo-y-tradicion'),
            ),
        );
    }
}

if (! function_exists('uniforma_category_get_terms_with_counts')) {
    /**
     * Igual que uniforma_category_get_terms_for_products(), pero agrega
     * ->uniforma_count con la cantidad de productos (dentro de $product_ids)
     * que tienen cada término, para mostrarlo junto al filtro.
     */
    function uniforma_category_get_terms_with_counts($taxonomy, $product_ids)
    {
        $terms = uniforma_category_get_terms_for_products($taxonomy, $product_ids);

        if (empty($terms) || empty($product_ids)) {
            return $terms;
        }

        $counts = array();
        $pairs = wp_get_object_terms(array_map('intval', $product_ids), $taxonomy, array(
            'fields' => 'all_with_object_id',
        ));

        if (! is_wp_error($pairs)) {
            foreach ((array) $pairs as $pair) {
                $term_id = (int) $pair->term_id;
                $counts[$term_id] = isset($counts[$term_id]) ? $counts[$term_id] + 1 : 1;
            }
        }

        foreach ($terms as $term) {
            $term->uniforma_count = isset($counts[(int) $term->term_id]) ? $counts[(int) $term->term_id] : 0;
        }

        return $terms;
    }
}

if (! function_exists('uniforma_category_add_rubro_counts')) {
    /**
     * Agrega ['count' => N] a cada opción de rubro con la cantidad de productos
     * (dentro de $product_ids) que pertenecen a ese rubro.
     */
    function uniforma_category_add_rubro_counts($rubro_options, $product_ids)
    {
        if (empty($rubro_options) || empty($product_ids)) {
            foreach ($rubro_options as $key => $option) {
                $rubro_options[$key]['count'] = 0;
            }

            return $rubro_options;
        }

        $product_terms = array();
        $pairs = wp_get_object_terms(array_map('intval', $product_ids), 'product_cat', array(
            'fields' => 'all_with_object_id',
        ));

        if (! is_wp_error($pairs)) {
            foreach ((array) $pairs as $pair) {
                $product_terms[(int) $pair->object_id][] = (int) $pair->term_id;
            }
        }

        foreach ($rubro_options as $key => $option) {
            $count = 0;

            foreach ($product_terms as $term_ids) {
                if (array_intersect($option['term_ids'], $term_ids)) {
                    $count++;
                }
            }

            $rubro_options[$key]['count'] = $count;
        }

        return $rubro_options;
    }
}

if (! function_exists('uniforma_category_rubro_filter_definitions')) {
    /**
     * Lista curada de sub-filtros por rubro (planilla "Filtros por rubro").
     * Cada filtro intenta resolverse contra una o más categorías de producto
     * existentes (por slug). Si ninguna existe todavía, el filtro queda
     * preparado pero oculto (0 productos) hasta que se publique mercadería
     * en una categoría con ese nombre.
     */
    function uniforma_category_rubro_filter_definitions()
    {
        return array(
            'gastronomia' => array(
                array('label' => 'Delantales', 'cat_slugs' => array('delantales')),
                array('label' => 'Faldones', 'cat_slugs' => array('faldones')),
                array('label' => 'Chaquetas', 'cat_slugs' => array('chaquetas', 'camisas-y-chaquetas')),
                array('label' => 'Casacas', 'cat_slugs' => array('casacas')),
                array('label' => 'Cofias, bandanas y gorros', 'cat_slugs' => array('cofias-bandanas-y-gorros', 'accesorios-gastronomia', 'accesorios')),
            ),
            'salud-estetica' => array(
                array('label' => 'Ambos', 'cat_slugs' => array('ambos', 'ambos-y-guardapolvos')),
                array('label' => 'Accesorios', 'cat_slugs' => array('accesorios')),
            ),
            'industria-construccion' => array(
                array('label' => 'Pantalones de trabajo', 'cat_slugs' => array('pantalones-de-trabajo', 'pantalones')),
                array('label' => 'Camperas de trabajo', 'cat_slugs' => array('camperas-de-trabajo', 'buzos-y-camperas')),
                array('label' => 'Prendas polares', 'cat_slugs' => array('prendas-polares')),
                array('label' => 'Mamelucos', 'cat_slugs' => array('mamelucos')),
                array('label' => 'Chalecos', 'cat_slugs' => array('chalecos')),
                array('label' => 'Calzado', 'cat_slugs' => array('zapatillas', 'calzado')),
            ),
            'comercio-atencion' => array(
                array('label' => 'Remeras', 'cat_slugs' => array('remeras')),
                array('label' => 'Chombas', 'cat_slugs' => array('chombas')),
                array('label' => 'Buzos y canguros', 'cat_slugs' => array('buzos-y-canguros', 'buzos-y-camperas')),
                array('label' => 'Jeans', 'cat_slugs' => array('jeans')),
            ),
            'empresas-oficinas' => array(
                array('label' => 'Camisas', 'cat_slugs' => array('camisas', 'camisas-y-chaquetas')),
                array('label' => 'Trajes', 'cat_slugs' => array('trajes')),
                array('label' => 'Sacos y blazers', 'cat_slugs' => array('sacos-y-blazers')),
                array('label' => 'Pantalones', 'cat_slugs' => array('pantalones')),
                array('label' => 'Faldas', 'cat_slugs' => array('faldas')),
                array('label' => 'Tapados', 'cat_slugs' => array('tapados')),
            ),
            'campo-tradicion' => array(
                array('label' => 'Bombachas de campo', 'cat_slugs' => array('bombachas-de-campo')),
                array('label' => 'Camisas', 'cat_slugs' => array('camisas', 'camisas-y-chaquetas')),
                array('label' => 'Camperas', 'cat_slugs' => array('camperas', 'buzos-y-camperas')),
                array('label' => 'Boinas', 'cat_slugs' => array('boinas')),
                array('label' => 'Calzado', 'cat_slugs' => array('zapatillas', 'calzado')),
            ),
        );
    }
}

if (! function_exists('uniforma_category_get_rubro_filters')) {
    /**
     * Devuelve los sub-filtros curados de un rubro, cada uno con su cantidad
     * de productos (intersección entre el rubro y las categorías candidatas).
     * Solo se devuelven los que tienen al menos 1 producto publicado.
     */
    function uniforma_category_get_rubro_filters($rubro_key, $rubro_product_ids)
    {
        $definitions = uniforma_category_rubro_filter_definitions();

        if (empty($definitions[$rubro_key]) || empty($rubro_product_ids)) {
            return array();
        }

        $filters = array();

        foreach ($definitions[$rubro_key] as $definition) {
            $target_ids = array();

            foreach ($definition['cat_slugs'] as $cat_slug) {
                foreach (uniforma_get_category_product_ids($cat_slug) as $product_id) {
                    $target_ids[$product_id] = $product_id;
                }
            }

            $matching_ids = array_intersect($rubro_product_ids, $target_ids);
            $count = count($matching_ids);

            if ($count < 1) {
                continue;
            }

            $filters[] = array(
                'key' => sanitize_title($definition['label']),
                'label' => $definition['label'],
                'cat_slugs' => $definition['cat_slugs'],
                'count' => $count,
            );
        }

        return $filters;
    }
}

if (! function_exists('uniforma_category_resolve_rubro_filter_cat_slugs')) {
    /**
     * A partir de las claves de sub-filtro seleccionadas (tipo[] en una
     * página de rubro), devuelve todos los slugs de categoría candidatos
     * a incluir en el tax_query.
     */
    function uniforma_category_resolve_rubro_filter_cat_slugs($rubro_key, $selected_keys)
    {
        $definitions = uniforma_category_rubro_filter_definitions();
        $slugs = array();

        if (empty($definitions[$rubro_key]) || empty($selected_keys)) {
            return $slugs;
        }

        foreach ($definitions[$rubro_key] as $definition) {
            if (in_array(sanitize_title($definition['label']), $selected_keys, true)) {
                foreach ($definition['cat_slugs'] as $cat_slug) {
                    $slugs[$cat_slug] = $cat_slug;
                }
            }
        }

        return array_values($slugs);
    }
}

if (! function_exists('uniforma_category_hero_image_map')) {
    /**
     * Banners propios del theme para categorías y rubros, usados cuando la
     * categoría de WooCommerce todavía no tiene una "Imagen" cargada desde
     * el admin. Rutas relativas a la carpeta del theme.
     */
    function uniforma_category_hero_image_map()
    {
        return array(
            'ambos-y-guardapolvos'    => 'assets/images/category-heroes/uniforma-hero-ambos-y-guardapolvos.webp',
            'camisas-y-chaquetas'     => 'assets/images/category-heroes/uniforma-hero-camisas-y-chaquetas.webp',
            'campo-tradicion'         => 'assets/images/category-heroes/uniforma-hero-campo-tradicion.webp',
            'comercio-atencion'       => 'assets/images/category-heroes/uniforma-hero-comercio-atencion.webp',
            'delantales'              => 'assets/images/category-heroes/uniforma-hero-delantales.webp',
            'empresas-oficinas'       => 'assets/images/category-heroes/uniforma-hero-empresas-oficinas.webp',
            'gastronomia'             => 'assets/images/category-heroes/uniforma-hero-gastronomia.webp',
            'industria-construccion'  => 'assets/images/category-heroes/uniforma-hero-industria-construccion.webp',
            'salud-estetica'          => 'assets/images/category-heroes/uniforma-hero-salud-estetica.webp',
        );
    }
}

if (! function_exists('uniforma_category_get_rubro_options')) {
    function uniforma_category_get_rubro_options($current_term = null)
    {
        if (! taxonomy_exists('product_cat')) {
            return array();
        }

        $options = array();

        foreach (uniforma_category_rubro_definitions() as $key => $definition) {
            $term_ids = array();
            $slugs = array();
            $is_current_context = false;

            foreach ($definition['slugs'] as $candidate_slug) {
                $term = get_term_by('slug', $candidate_slug, 'product_cat');

                if (! $term || is_wp_error($term)) {
                    continue;
                }

                $term_ids[(int) $term->term_id] = (int) $term->term_id;
                $slugs[$term->slug] = $term->slug;

                if ($current_term instanceof WP_Term) {
                    if ((int) $current_term->term_id === (int) $term->term_id) {
                        $is_current_context = true;
                    } elseif (term_is_ancestor_of($term, $current_term, 'product_cat')) {
                        $is_current_context = true;
                    }
                }
            }

            if (empty($term_ids)) {
                continue;
            }

            $options[$key] = array(
                'key' => $key,
                'label' => $definition['label'],
                'term_ids' => array_values($term_ids),
                'slugs' => array_values($slugs),
                'is_current_context' => $is_current_context,
            );
        }

        return $options;
    }
}

if (! function_exists('uniforma_category_resolve_rubro_term_ids')) {
    function uniforma_category_resolve_rubro_term_ids($selected_values, $rubro_options)
    {
        $term_ids = array();

        foreach ((array) $selected_values as $selected_value) {
            if (isset($rubro_options[$selected_value])) {
                foreach ($rubro_options[$selected_value]['term_ids'] as $term_id) {
                    $term_ids[(int) $term_id] = (int) $term_id;
                }
                continue;
            }

            foreach ($rubro_options as $option) {
                if (! in_array($selected_value, $option['slugs'], true)) {
                    continue;
                }

                foreach ($option['term_ids'] as $term_id) {
                    $term_ids[(int) $term_id] = (int) $term_id;
                }
            }
        }

        return array_values($term_ids);
    }
}


/**
 * Paginación de categorías/rubros y búsqueda de productos.
 *
 * Las plantillas arman su propia consulta de 12 productos por página, pero la URL
 * /page/2/ la valida WordPress con la consulta principal. Si ésta usaba otro
 * tamaño de página (WooCommerce: 16), la página 2 daba «no encontrada» aunque
 * hubiera más productos. Se igualan los dos tamaños.
 */
function uniforma_archive_products_per_page($query)
{
    if (is_admin() || ! $query->is_main_query()) {
        return;
    }

    $is_category = $query->is_tax('product_cat');
    $is_product_search = $query->is_search() && 'product' === $query->get('post_type');

    if ($is_category || $is_product_search) {
        $query->set('posts_per_page', 12);
    }
}
add_action('pre_get_posts', 'uniforma_archive_products_per_page');

/**
 * Red de seguridad: si alguien llega a una página inexistente de una categoría
 * (por ejemplo desde un enlace viejo), se lo lleva a la primera página en lugar
 * de mostrar «no encontrada».
 */
function uniforma_category_page_overflow_redirect()
{
    if (! is_404() || (int) get_query_var('paged') < 2) {
        return;
    }

    $slug = get_query_var('product_cat');

    if (! $slug) {
        return;
    }

    $term = get_term_by('slug', $slug, 'product_cat');
    $link = $term ? get_term_link($term) : '';

    if ($link && ! is_wp_error($link)) {
        wp_safe_redirect($link);
        exit;
    }
}
add_action('template_redirect', 'uniforma_category_page_overflow_redirect');
