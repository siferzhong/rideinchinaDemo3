<?php
/**
 * Plugin Name: Ride In China Complete API
 * Description: Complete REST API endpoints for Ride In China app - User data, permissions, group destinations, group chat, group locations
 * Version: 1.1.1
 * Author: Ride In China
 */

// 防止直接访问
if (!defined('ABSPATH')) {
    exit;
}

// 防止函数重复定义
if (!function_exists('rideinchina_init_api')) {
    add_action('rest_api_init', 'rideinchina_init_api');
}

function rideinchina_init_api() {
    // ========== 用户数据端点 ==========
    register_rest_route('wp/v2', '/rideinchina/user-data', array(
        'methods' => 'POST',
        'callback' => 'rideinchina_save_user_data',
        'permission_callback' => 'rideinchina_check_auth',
    ));

    register_rest_route('wp/v2', '/rideinchina/user-data/(?P<meta_key>[a-zA-Z0-9_-]+)', array(
        'methods' => 'GET',
        'callback' => 'rideinchina_get_user_data',
        'permission_callback' => 'rideinchina_check_auth',
    ));

    // ========== 用户角色端点 ==========
    register_rest_route('wp/v2', '/rideinchina/user-role', array(
        'methods' => 'GET',
        'callback' => 'rideinchina_get_user_role',
        'permission_callback' => 'rideinchina_check_auth',
    ));

    // ========== 群目的地端点 ==========
    register_rest_route('wp/v2', '/rideinchina/group-destination', array(
        'methods' => 'GET',
        'callback' => 'rideinchina_get_group_destination',
        'permission_callback' => '__return_true',
    ));

    register_rest_route('wp/v2', '/rideinchina/group-destination', array(
        'methods' => 'POST',
        'callback' => 'rideinchina_set_group_destination',
        'permission_callback' => 'rideinchina_check_leader',
    ));

    register_rest_route('wp/v2', '/rideinchina/group-destination', array(
        'methods' => 'DELETE',
        'callback' => 'rideinchina_clear_group_destination',
        'permission_callback' => 'rideinchina_check_admin',
    ));

    // ========== 群消息端点 ==========
    register_rest_route('wp/v2', '/rideinchina/group-messages', array(
        'methods' => 'GET',
        'callback' => 'rideinchina_get_group_messages',
        'permission_callback' => '__return_true',
    ));

    register_rest_route('wp/v2', '/rideinchina/group-messages', array(
        'methods' => 'POST',
        'callback' => 'rideinchina_send_group_message',
        'permission_callback' => 'rideinchina_check_leader',
    ));

    // ========== 群位置共享端点（新增）==========
    register_rest_route('wp/v2', '/rideinchina/group-locations', array(
        'methods' => 'GET',
        'callback' => 'rideinchina_get_group_locations',
        'permission_callback' => 'rideinchina_check_auth',
    ));

    register_rest_route('wp/v2', '/rideinchina/group-locations', array(
        'methods' => 'POST',
        'callback' => 'rideinchina_upsert_group_location',
        'permission_callback' => 'rideinchina_check_auth',
    ));

    // ========== 管理员端点 ==========
    register_rest_route('wp/v2', '/rideinchina/admin/users', array(
        'methods' => 'GET',
        'callback' => 'rideinchina_get_all_users',
        'permission_callback' => 'rideinchina_check_admin',
    ));

    register_rest_route('wp/v2', '/rideinchina/admin/users/documents', array(
        'methods' => 'GET',
        'callback' => 'rideinchina_get_all_user_documents',
        'permission_callback' => 'rideinchina_check_admin',
    ));

    register_rest_route('wp/v2', '/rideinchina/admin/users/(?P<user_id>\d+)/documents/(?P<doc_id>[a-zA-Z0-9_-]+)', array(
        'methods' => 'PATCH',
        'callback' => 'rideinchina_update_document_status',
        'permission_callback' => 'rideinchina_check_admin',
    ));

    register_rest_route('wp/v2', '/rideinchina/admin/users/(?P<user_id>\d+)/permit', array(
        'methods' => 'POST',
        'callback' => 'rideinchina_upload_permit',
        'permission_callback' => 'rideinchina_check_admin',
    ));

    register_rest_route('wp/v2', '/rideinchina/admin/users/(?P<user_id>\d+)/role', array(
        'methods' => 'POST',
        'callback' => 'rideinchina_set_user_role',
        'permission_callback' => 'rideinchina_check_admin',
    ));
}

// ========== 权限检查函数 ==========

if (!function_exists('rideinchina_check_auth')) {
function rideinchina_check_auth() {
    return is_user_logged_in();
}
}

if (!function_exists('rideinchina_check_admin')) {
function rideinchina_check_admin() {
    if (!is_user_logged_in()) {
        return false;
    }
    $user = wp_get_current_user();
    $role = get_user_meta($user->ID, 'rideinchina_role', true);
    return $role === 'admin' || user_can($user, 'administrator');
}
}

if (!function_exists('rideinchina_check_leader')) {
function rideinchina_check_leader() {
    if (!is_user_logged_in()) {
        return false;
    }
    $user = wp_get_current_user();
    $role = get_user_meta($user->ID, 'rideinchina_role', true);
    return $role === 'admin' || $role === 'leader' || user_can($user, 'administrator');
}
}

// ========== 用户数据函数 ==========

if (!function_exists('rideinchina_save_user_data')) {
function rideinchina_save_user_data(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    $meta_key = sanitize_text_field($request['meta_key']);
    $meta_value = $request['meta_value'];

    update_user_meta($user_id, $meta_key, $meta_value);

    return new WP_REST_Response(array(
        'success' => true,
        'meta_key' => $meta_key,
    ), 200);
}
}

if (!function_exists('rideinchina_get_user_data')) {
function rideinchina_get_user_data(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    $meta_key = sanitize_text_field($request['meta_key']);

    $meta_value = get_user_meta($user_id, $meta_key, true);

    return new WP_REST_Response($meta_value ?: null, 200);
}
}

// ========== 用户角色函数 ==========

if (!function_exists('rideinchina_get_user_role')) {
function rideinchina_get_user_role(WP_REST_Request $request) {
    $user = wp_get_current_user();
    
    if (user_can($user, 'administrator')) {
        return new WP_REST_Response(array('role' => 'admin'), 200);
    }
    
    $role = get_user_meta($user->ID, 'rideinchina_role', true);
    if (!$role) {
        $role = 'user';
        update_user_meta($user->ID, 'rideinchina_role', $role);
    }
    
    return new WP_REST_Response(array('role' => $role), 200);
}
}

// ========== 群目的地函数 ==========

if (!function_exists('rideinchina_get_group_destination')) {
function rideinchina_get_group_destination(WP_REST_Request $request) {
    $destination = get_option('rideinchina_group_destination', null);
    return new WP_REST_Response($destination, 200);
}
}

if (!function_exists('rideinchina_set_group_destination')) {
function rideinchina_set_group_destination(WP_REST_Request $request) {
    $user = wp_get_current_user();
    $name = sanitize_text_field($request['name']);
    $position = $request['position'];
    $address = sanitize_text_field($request['address'] ?? '');

    if (!$name || !$position || count($position) !== 2) {
        return new WP_Error('invalid_data', 'Invalid destination data', array('status' => 400));
    }

    $destination = array(
        'id' => uniqid(),
        'name' => $name,
        'position' => array(floatval($position[0]), floatval($position[1])),
        'address' => $address,
        'setBy' => array(
            'id' => $user->ID,
            'name' => $user->display_name,
            'role' => get_user_meta($user->ID, 'rideinchina_role', true) ?: 'user',
        ),
        'createdAt' => current_time('mysql'),
        'isActive' => true,
    );

    update_option('rideinchina_group_destination', $destination);

    return new WP_REST_Response($destination, 200);
}
}

if (!function_exists('rideinchina_clear_group_destination')) {
function rideinchina_clear_group_destination(WP_REST_Request $request) {
    delete_option('rideinchina_group_destination');
    return new WP_REST_Response(array('success' => true), 200);
}
}

// ========== 群消息函数 ==========

if (!function_exists('rideinchina_get_group_messages')) {
function rideinchina_get_group_messages(WP_REST_Request $request) {
    $limit = intval($request->get_param('limit') ?: 50);
    $since = $request->get_param('since');
    
    $messages = get_option('rideinchina_group_messages', array());
    
    usort($messages, function($a, $b) {
        return strtotime($b['timestamp']) - strtotime($a['timestamp']);
    });
    
    if ($since) {
        $messages = array_filter($messages, function($msg) use ($since) {
            return strtotime($msg['timestamp']) > strtotime($since);
        });
    }
    
    $messages = array_slice($messages, 0, $limit);
    
    return new WP_REST_Response(array('messages' => array_values($messages)), 200);
}
}

if (!function_exists('rideinchina_send_group_message')) {
function rideinchina_send_group_message(WP_REST_Request $request) {
    $user = wp_get_current_user();
    $message = sanitize_text_field($request['message'] ?? '');
    $image_base64 = $request->get_param('image_base64');
    $video_base64 = $request->get_param('video_base64');

    if (!$message && !$image_base64 && !$video_base64) {
        return new WP_Error('invalid_data', 'Message or media is required', array('status' => 400));
    }

    $user_role = get_user_meta($user->ID, 'rideinchina_role', true);
    if (!$user_role && user_can($user, 'administrator')) {
        $user_role = 'admin';
    }
    if (!$user_role) {
        $user_role = 'user';
    }

    $new_message = array(
        'id' => uniqid(),
        'userId' => $user->ID,
        'userName' => $user->display_name,
        'userRole' => $user_role,
        'message' => $message ?: '',
        'timestamp' => current_time('mysql'),
        'isHighlighted' => $user_role === 'admin' || $user_role === 'leader',
    );
    if (is_string($image_base64) && $image_base64 !== '') {
        $new_message['imageUrl'] = $image_base64;
    }
    if (is_string($video_base64) && $video_base64 !== '') {
        $new_message['videoUrl'] = $video_base64;
    }

    $messages = get_option('rideinchina_group_messages', array());
    $messages[] = $new_message;
    
    if (count($messages) > 100) {
        usort($messages, function($a, $b) {
            return strtotime($a['timestamp']) - strtotime($b['timestamp']);
        });
        $messages = array_slice($messages, -100);
    }
    
    update_option('rideinchina_group_messages', $messages);

    return new WP_REST_Response($new_message, 200);
}
}

// ========== 群位置共享函数（新增）==========

if (!function_exists('rideinchina_upsert_group_location')) {
function rideinchina_upsert_group_location(WP_REST_Request $request) {
    $user = wp_get_current_user();
    $lng = floatval($request->get_param('lng'));
    $lat = floatval($request->get_param('lat'));
    $speedKmh = $request->get_param('speedKmh');
    $altitudeM = $request->get_param('altitudeM');
    $heading = $request->get_param('heading');

    if (!$lng || !$lat) {
        return new WP_Error('invalid_data', 'lng/lat required', array('status' => 400));
    }

    $user_role = get_user_meta($user->ID, 'rideinchina_role', true);
    if (!$user_role && user_can($user, 'administrator')) {
        $user_role = 'admin';
    }
    if (!$user_role) {
        $user_role = 'user';
    }

    $locations = get_option('rideinchina_group_locations', array());
    if (!is_array($locations)) $locations = array();

    $locations[strval($user->ID)] = array(
        'userId' => $user->ID,
        'userName' => $user->display_name,
        'userRole' => $user_role,
        'position' => array($lng, $lat),
        'speedKmh' => is_null($speedKmh) ? null : floatval($speedKmh),
        'altitudeM' => is_null($altitudeM) ? null : floatval($altitudeM),
        'heading' => is_null($heading) ? null : floatval($heading),
        'timestamp' => current_time('mysql'),
    );

    // 清理过期位置（10分钟未更新）
    $now = time();
    foreach ($locations as $key => $loc) {
        $ts = isset($loc['timestamp']) ? strtotime($loc['timestamp']) : 0;
        if ($ts && ($now - $ts) > 600) {
            unset($locations[$key]);
        }
    }

    update_option('rideinchina_group_locations', $locations);
    return new WP_REST_Response(array('success' => true), 200);
}
}

if (!function_exists('rideinchina_get_group_locations')) {
function rideinchina_get_group_locations(WP_REST_Request $request) {
    $locations = get_option('rideinchina_group_locations', array());
    if (!is_array($locations)) $locations = array();

    $riders = array_values($locations);
    usort($riders, function($a, $b) {
        return strtotime($b['timestamp'] ?? '') - strtotime($a['timestamp'] ?? '');
    });

    return new WP_REST_Response(array('riders' => $riders), 200);
}
}

// ========== 管理员函数 ==========

if (!function_exists('rideinchina_get_all_users')) {
function rideinchina_get_all_users(WP_REST_Request $request) {
    $users = get_users();
    $result = array();

    foreach ($users as $user) {
        $role = get_user_meta($user->ID, 'rideinchina_role', true);
        if (!$role && user_can($user, 'administrator')) {
            $role = 'admin';
        }
        if (!$role) {
            $role = 'user';
        }

        $result[] = array(
            'id' => $user->ID,
            'username' => $user->user_login,
            'email' => $user->user_email,
            'name' => $user->display_name,
            'role' => $role,
        );
    }

    return new WP_REST_Response(array('users' => $result), 200);
}
}

if (!function_exists('rideinchina_get_all_user_documents')) {
function rideinchina_get_all_user_documents(WP_REST_Request $request) {
    $users = get_users();
    $result = array();

    foreach ($users as $user) {
        $documents = get_user_meta($user->ID, 'rideinchina_documents', true) ?: array();
        $permits = get_user_meta($user->ID, 'rideinchina_tibet_permits', true) ?: array();

        if (!empty($documents) || !empty($permits)) {
            $result[] = array(
                'userId' => $user->ID,
                'userName' => $user->display_name,
                'userEmail' => $user->user_email,
                'documents' => $documents,
                'permits' => $permits,
            );
        }
    }

    return new WP_REST_Response(array('users' => $result), 200);
}
}

if (!function_exists('rideinchina_update_document_status')) {
function rideinchina_update_document_status(WP_REST_Request $request) {
    $user_id = intval($request['user_id']);
    $doc_id = sanitize_text_field($request['doc_id']);
    $status = sanitize_text_field($request['status']);

    if (!in_array($status, array('Pending', 'Verified', 'Rejected'))) {
        return new WP_Error('invalid_status', 'Invalid status', array('status' => 400));
    }

    $documents = get_user_meta($user_id, 'rideinchina_documents', true) ?: array();
    
    foreach ($documents as &$doc) {
        if ($doc['id'] === $doc_id) {
            $doc['status'] = $status;
            break;
        }
    }

    update_user_meta($user_id, 'rideinchina_documents', $documents);

    return new WP_REST_Response(array('success' => true), 200);
}
}

if (!function_exists('rideinchina_upload_permit')) {
function rideinchina_upload_permit(WP_REST_Request $request) {
    $user_id = intval($request['user_id']);
    $permit_number = sanitize_text_field($request['permitNumber']);
    $issue_date = sanitize_text_field($request['issueDate']);
    $expiry_date = sanitize_text_field($request['expiryDate']);
    $file_url = esc_url_raw($request['fileUrl']);
    $route = sanitize_text_field($request['route'] ?? '');

    $permits = get_user_meta($user_id, 'rideinchina_tibet_permits', true) ?: array();

    $new_permit = array(
        'id' => uniqid(),
        'permitNumber' => $permit_number,
        'issueDate' => $issue_date,
        'expiryDate' => $expiry_date,
        'status' => 'Active',
        'fileUrl' => $file_url,
        'route' => $route,
    );

    $permits[] = $new_permit;
    update_user_meta($user_id, 'rideinchina_tibet_permits', $permits);

    return new WP_REST_Response(array('success' => true, 'permit' => $new_permit), 200);
}
}

if (!function_exists('rideinchina_set_user_role')) {
function rideinchina_set_user_role(WP_REST_Request $request) {
    $user_id = intval($request['user_id']);
    $role = sanitize_text_field($request['role']);

    if (!in_array($role, array('admin', 'leader', 'user'))) {
        return new WP_Error('invalid_role', 'Invalid role', array('status' => 400));
    }

    update_user_meta($user_id, 'rideinchina_role', $role);

    return new WP_REST_Response(array('success' => true), 200);
}
}
