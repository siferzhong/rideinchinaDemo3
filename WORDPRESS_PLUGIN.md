# WordPress 插件代码 - 完整版

将以下代码保存为 `rideinchina-complete.php` 并上传到 WordPress 的 `/wp-content/plugins/rideinchina-complete/` 目录。

```php
<?php
/**
 * Plugin Name: Ride In China Complete API
 * Description: Complete REST API endpoints for Ride In China app - User data, permissions, group destinations, group chat
 * Version: 1.0.0
 */

add_action('rest_api_init', function () {
    // ========== 用户数据端点（已有） ==========
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
        'permission_callback' => '__return_true', // 所有人都可以查看
    ));

    register_rest_route('wp/v2', '/rideinchina/group-destination', array(
        'methods' => 'POST',
        'callback' => 'rideinchina_set_group_destination',
        'permission_callback' => 'rideinchina_check_leader', // 仅管理员和领队
    ));

    register_rest_route('wp/v2', '/rideinchina/group-destination', array(
        'methods' => 'DELETE',
        'callback' => 'rideinchina_clear_group_destination',
        'permission_callback' => 'rideinchina_check_admin', // 仅管理员
    ));

    // ========== 群消息端点 ==========
    register_rest_route('wp/v2', '/rideinchina/group-messages', array(
        'methods' => 'GET',
        'callback' => 'rideinchina_get_group_messages',
        'permission_callback' => '__return_true', // 所有人都可以查看
    ));

    register_rest_route('wp/v2', '/rideinchina/group-messages', array(
        'methods' => 'POST',
        'callback' => 'rideinchina_send_group_message',
        'permission_callback' => 'rideinchina_check_leader', // 仅管理员和领队
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
});

// ========== 权限检查函数 ==========

function rideinchina_check_auth() {
    return is_user_logged_in();
}

function rideinchina_check_admin() {
    if (!is_user_logged_in()) {
        return false;
    }
    $user = wp_get_current_user();
    $role = get_user_meta($user->ID, 'rideinchina_role', true);
    return $role === 'admin' || user_can($user, 'administrator');
}

function rideinchina_check_leader() {
    if (!is_user_logged_in()) {
        return false;
    }
    $user = wp_get_current_user();
    $role = get_user_meta($user->ID, 'rideinchina_role', true);
    return $role === 'admin' || $role === 'leader' || user_can($user, 'administrator');
}

// ========== 用户数据函数（已有） ==========

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

function rideinchina_get_user_data(WP_REST_Request $request) {
    $user_id = get_current_user_id();
    $meta_key = sanitize_text_field($request['meta_key']);

    $meta_value = get_user_meta($user_id, $meta_key, true);

    return new WP_REST_Response($meta_value ?: null, 200);
}

// ========== 用户角色函数 ==========

function rideinchina_get_user_role(WP_REST_Request $request) {
    $user = wp_get_current_user();
    
    // 检查 WordPress 管理员角色
    if (user_can($user, 'administrator')) {
        return new WP_REST_Response(array('role' => 'admin'), 200);
    }
    
    // 检查自定义角色
    $role = get_user_meta($user->ID, 'rideinchina_role', true);
    if (!$role) {
        $role = 'user'; // 默认角色
        update_user_meta($user->ID, 'rideinchina_role', $role);
    }
    
    return new WP_REST_Response(array('role' => $role), 200);
}

// ========== 群目的地函数 ==========

function rideinchina_get_group_destination(WP_REST_Request $request) {
    $destination = get_option('rideinchina_group_destination', null);
    return new WP_REST_Response($destination, 200);
}

function rideinchina_set_group_destination(WP_REST_Request $request) {
    $user = wp_get_current_user();
    $name = sanitize_text_field($request['name']);
    $position = $request['position']; // [lng, lat]
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

function rideinchina_clear_group_destination(WP_REST_Request $request) {
    delete_option('rideinchina_group_destination');
    return new WP_REST_Response(array('success' => true), 200);
}

// ========== 群消息函数 ==========

function rideinchina_get_group_messages(WP_REST_Request $request) {
    $limit = intval($request->get_param('limit') ?: 50);
    $since = $request->get_param('since');
    
    $messages = get_option('rideinchina_group_messages', array());
    
    // 按时间戳排序（最新的在前）
    usort($messages, function($a, $b) {
        return strtotime($b['timestamp']) - strtotime($a['timestamp']);
    });
    
    // 如果有 since 参数，只返回之后的消息
    if ($since) {
        $messages = array_filter($messages, function($msg) use ($since) {
            return strtotime($msg['timestamp']) > strtotime($since);
        });
    }
    
    // 限制数量
    $messages = array_slice($messages, 0, $limit);
    
    return new WP_REST_Response(array('messages' => array_values($messages)), 200);
}

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
    
    // 只保留最近 100 条消息
    if (count($messages) > 100) {
        usort($messages, function($a, $b) {
            return strtotime($a['timestamp']) - strtotime($b['timestamp']);
        });
        $messages = array_slice($messages, -100);
    }
    
    update_option('rideinchina_group_messages', $messages);

    return new WP_REST_Response($new_message, 200);
}

// ========== 管理员函数 ==========

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

function rideinchina_set_user_role(WP_REST_Request $request) {
    $user_id = intval($request['user_id']);
    $role = sanitize_text_field($request['role']);

    if (!in_array($role, array('admin', 'leader', 'user'))) {
        return new WP_Error('invalid_role', 'Invalid role', array('status' => 400));
    }

    update_user_meta($user_id, 'rideinchina_role', $role);

    return new WP_REST_Response(array('success' => true), 200);
}
```

## 安装步骤

1. 在 WordPress 的 `/wp-content/plugins/` 目录创建文件夹 `rideinchina-complete`
2. 在该文件夹中创建 `rideinchina-complete.php` 文件
3. 粘贴上面的代码
4. 在 WordPress 后台激活插件

## 设置第一个管理员

在 WordPress 数据库中执行以下 SQL（或通过 phpMyAdmin）：

```sql
UPDATE wp_usermeta 
SET meta_value = 'admin' 
WHERE meta_key = 'rideinchina_role' 
AND user_id = YOUR_ADMIN_USER_ID;
```

或者通过 WordPress 后台的"用户"页面，编辑你的用户，在"自定义字段"中添加：
- 键：`rideinchina_role`
- 值：`admin`

## 功能说明

1. **用户角色管理**：通过用户元数据 `rideinchina_role` 存储角色（admin/leader/user）
2. **群目的地**：存储在 WordPress options 表中
3. **群消息**：存储在 WordPress options 表中，最多保留 100 条
4. **用户数据**：存储在用户元数据中

所有端点都已实现，可以开始测试了！
